import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { assertIncidentTransition, severityRank } from "@/lib/state-machines";
import { slaWindows } from "@/lib/sla";
import { can, type PermissionAction } from "@/lib/rbac";
import type { AuthContext } from "@/lib/auth";
import type { IncidentStatus, Priority } from "@/lib/constants";

// Incident service — mọi mutation: permission check (defense-in-depth, service tự assert)
// + state machine + SLA + timeline + audit + notification.

async function notify(opts: {
  workspaceId: string;
  userIds: string[];
  title: string;
  body?: string;
  type: string;
  refId?: string;
}) {
  if (opts.userIds.length === 0) return;
  await prisma.notification.createMany({
    data: opts.userIds.map((userId) => ({
      workspaceId: opts.workspaceId,
      userId,
      title: opts.title,
      body: opts.body,
      type: opts.type,
      refId: opts.refId,
    })),
  });
}

async function workspaceUserIdsByRoles(workspaceId: string, roles: string[]): Promise<string[]> {
  const ms = await prisma.membership.findMany({
    where: { workspaceId, role: { in: roles } },
    select: { userId: true },
  });
  return ms.map((m) => m.userId);
}

export async function nextIncidentCode(workspaceId: string): Promise<string> {
  const count = await prisma.incident.count({ where: { workspaceId } });
  return `INC-${String(count + 1).padStart(4, "0")}`;
}

export async function createIncidentFromAlert(ctx: AuthContext, alertId: string, input: {
  title?: string;
  summary?: string;
  severity?: Priority;
  ownerId?: string;
  requestKey?: string;
}) {
  assertCanAct(ctx, "incident.create");
  const alert = await prisma.alert.findUnique({ where: { id: alertId }, include: { signal: true } });
  if (!alert) throw notFound("Không tìm thấy alert");
  const event = await prisma.liveEvent.findUnique({ where: { id: alert.eventId } });
  if (!event || event.workspaceId !== ctx.workspaceId) throw forbidden("Alert không thuộc workspace của bạn");
  if (alert.incidentId) throw conflict("Alert này đã có incident");

  const severity = input.severity ?? (alert.priority as Priority);
  const sla = slaWindows(severity);
  const code = await nextIncidentCode(ctx.workspaceId);

  const incident = await prisma.incident.create({
    data: {
      workspaceId: ctx.workspaceId,
      eventId: event.id,
      code,
      title: input.title ?? alert.title,
      summary: input.summary ?? `${alert.reason} (velocity ${alert.velocity}/phút, evidence ${alert.evidenceCount})`,
      status: "OPEN",
      severity,
      ownerId: input.ownerId ?? null,
      slaAckDueAt: sla.ackDueAt,
      slaActionDueAt: sla.actionDueAt,
      alerts: { connect: [{ id: alert.id }] },
    },
  });
  await prisma.alert.update({ where: { id: alert.id }, data: { status: "CONVERTED", incidentId: incident.id } });
  if (input.ownerId) {
    await prisma.incidentAssignment.create({
      data: { incidentId: incident.id, userId: input.ownerId, role: "owner" },
    });
  }
  await prisma.incidentEvidence.create({
    data: { incidentId: incident.id, kind: "alert", refId: alert.id, content: `${alert.title} — ${alert.reason}` },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId: incident.id, actorId: ctx.user.id, action: "created", detail: `Từ alert ${alert.id}` },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.create",
    entityType: "incident",
    entityId: incident.id,
    detail: { alertId, severity, code },
  });
  const notifiable = await workspaceUserIdsByRoles(ctx.workspaceId, ["CRISIS_LEAD", "OWNER"]);
  await notify({
    workspaceId: ctx.workspaceId,
    userIds: notifiable.filter((u) => u !== ctx.user.id),
    title: `Incident mới ${code}: ${incident.title}`,
    body: `Severity ${severity}`,
    type: "incident_created",
    refId: incident.id,
  });
  return incident;
}

export async function createIncidentManual(ctx: AuthContext, eventId: string, input: {
  title: string;
  summary?: string;
  severity: Priority;
  ownerId?: string;
}) {
  assertCanAct(ctx, "incident.create");
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.workspaceId !== ctx.workspaceId) throw forbidden("Event không thuộc workspace của bạn");
  const sla = slaWindows(input.severity);
  const code = await nextIncidentCode(ctx.workspaceId);
  const incident = await prisma.incident.create({
    data: {
      workspaceId: ctx.workspaceId,
      eventId,
      code,
      title: input.title,
      summary: input.summary,
      status: "OPEN",
      severity: input.severity,
      ownerId: input.ownerId ?? null,
      slaAckDueAt: sla.ackDueAt,
      slaActionDueAt: sla.actionDueAt,
    },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId: incident.id, actorId: ctx.user.id, action: "created", detail: "Tạo thủ công" },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.create",
    entityType: "incident",
    entityId: incident.id,
    detail: { eventId, severity: input.severity, code },
  });
  return incident;
}

export async function assignIncident(ctx: AuthContext, incidentId: string, userId: string, role = "owner") {
  assertCanAct(ctx, "incident.assign");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  const member = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId } },
  });
  if (!member) throw forbidden("User được assign phải là member của workspace");
  await prisma.incidentAssignment.upsert({
    where: { incidentId_userId_role: { incidentId, userId, role } },
    create: { incidentId, userId, role },
    update: { role },
  });
  if (role === "owner") {
    await prisma.incident.update({ where: { id: incidentId }, data: { ownerId: userId } });
  }
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: "assigned", detail: `Assign ${role}: ${userId}` },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.assign",
    entityType: "incident",
    entityId: incidentId,
    detail: { userId, role },
  });
  await notify({
    workspaceId: ctx.workspaceId,
    userIds: [userId],
    title: `Bạn được assign incident ${incident.code}`,
    type: "alert_assigned",
    refId: incidentId,
  });
  return prisma.incident.findUnique({ where: { id: incidentId } });
}

export async function changeIncidentStatus(ctx: AuthContext, incidentId: string, to: IncidentStatus, extra?: {
  resolution?: string;
}) {
  assertCanAct(ctx, to === "RESOLVED" ? "incident.resolve" : "incident.update");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  assertIncidentTransition(incident.status as IncidentStatus, to);
  const data: Record<string, unknown> = { status: to };
  if (to === "RESOLVED") {
    data.resolvedAt = new Date();
    data.resolution = extra?.resolution ?? "Đã xử lý";
  }
  if (to === "REOPENED") {
    data.resolvedAt = null;
    data.reopenedCount = { increment: 1 };
  }
  const updated = await prisma.incident.update({ where: { id: incidentId }, data });
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: `status:${to}`, detail: extra?.resolution },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.status",
    entityType: "incident",
    entityId: incidentId,
    detail: { from: incident.status, to },
  });
  return updated;
}

export async function changeSeverity(ctx: AuthContext, incidentId: string, severity: Priority) {
  assertCanAct(ctx, "incident.severity");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  if (severityRank(incident.severity as Priority) === severityRank(severity)) return incident;
  const sla = slaWindows(severity, incident.createdAt);
  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: { severity, slaAckDueAt: sla.ackDueAt, slaActionDueAt: sla.actionDueAt },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: "severity", detail: `${incident.severity} → ${severity}` },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.severity",
    entityType: "incident",
    entityId: incidentId,
    detail: { from: incident.severity, to: severity },
  });
  return updated;
}

export async function escalateIncident(ctx: AuthContext, incidentId: string) {
  assertCanAct(ctx, "incident.escalate");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  // Thứ tự từ NHẸ đến NẶNG — escalate luôn đi về hướng NẶNG hơn
  const order: Priority[] = ["P3", "P2", "P1", "P0"];
  const idx = order.indexOf(incident.severity as Priority);
  if (idx >= order.length - 1) throw conflict("Incident đã ở mức severity cao nhất (P0)");
  const nextSeverity = order[idx + 1];
  const sla = slaWindows(nextSeverity, incident.createdAt);
  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: { severity: nextSeverity, slaAckDueAt: sla.ackDueAt, slaActionDueAt: sla.actionDueAt },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: "escalated", detail: `${incident.severity} → ${nextSeverity}` },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.escalate",
    entityType: "incident",
    entityId: incidentId,
    detail: { from: incident.severity, to: nextSeverity },
  });
  const leads = await workspaceUserIdsByRoles(ctx.workspaceId, ["CRISIS_LEAD", "OWNER"]);
  await notify({
    workspaceId: ctx.workspaceId,
    userIds: leads.filter((u) => u !== ctx.user.id),
    title: `Incident ${incident.code} được escalate lên ${nextSeverity}`,
    type: "incident_escalated",
    refId: incidentId,
  });
  return updated;
}

export async function addEvidence(ctx: AuthContext, incidentId: string, input: {
  kind: string;
  content: string;
  refId?: string;
}) {
  assertCanAct(ctx, "evidence.add");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  const ev = await prisma.incidentEvidence.create({
    data: { incidentId, kind: input.kind, content: input.content, refId: input.refId ?? null },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: "evidence_added", detail: input.kind },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.evidence",
    entityType: "incident",
    entityId: incidentId,
  });
  return ev;
}

export async function addNote(ctx: AuthContext, incidentId: string, body: string) {
  assertCanAct(ctx, "note.add");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  const note = await prisma.incidentNote.create({
    data: { incidentId, authorId: ctx.user.id, body },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: "note_added" },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.note",
    entityType: "incident",
    entityId: incidentId,
  });
  return note;
}

export async function acknowledgeIncident(ctx: AuthContext, incidentId: string) {
  assertCanAct(ctx, "incident.update");
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident || incident.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy incident");
  if (incident.slaAckAt) return incident;
  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: { slaAckAt: new Date() },
  });
  await prisma.incidentTimeline.create({
    data: { incidentId, actorId: ctx.user.id, action: "acknowledged" },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "incident.acknowledge",
    entityType: "incident",
    entityId: incidentId,
  });
  return updated;
}

export function assertCanAct(ctx: AuthContext, action: PermissionAction) {
  if (!can(ctx.role, action)) throw forbidden(`Vai trò ${ctx.role} không có quyền ${action}`);
}
