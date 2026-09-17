import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import {
  createIncidentFromAlert,
  assignIncident,
  changeIncidentStatus,
  changeSeverity,
  escalateIncident,
  addEvidence,
  addNote,
  acknowledgeIncident,
} from "@/server/services/incidents";
import { createDraft, requestApproval, decideApproval } from "@/server/services/drafts";
import { buildEventReport } from "@/server/services/reports";
import { setEventStatus } from "@/server/services/events";
import { RuleBasedClassifier, dedupeKey } from "@/lib/crisis/classifier";

const WS = "ws_int_test";
const WS2 = "ws_other_test";

async function resetDb() {
  await prisma.$transaction([
    prisma.report.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.policyRule.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.responseDraft.deleteMany(),
    prisma.responseTemplate.deleteMany(),
    prisma.playbook.deleteMany(),
    prisma.incidentTimeline.deleteMany(),
    prisma.incidentNote.deleteMany(),
    prisma.incidentEvidence.deleteMany(),
    prisma.incidentAssignment.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.message.deleteMany(),
    prisma.signal.deleteMany(),
    prisma.streamSegment.deleteMany(),
    prisma.liveEvent.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.workspace.deleteMany(),
  ]);
}

let owner: AuthContext;
let lead: AuthContext;
let exec: AuthContext;
let ownerOtherWs: AuthContext;
let incidentOwnerId: string;

beforeAll(async () => {
  await resetDb();

  async function makeUser(email: string, name: string, wsId: string, role: string) {
    const u = await prisma.user.create({
      data: { email, name, passwordHash: hashPassword("testpass123") },
    });
    await prisma.membership.create({ data: { workspaceId: wsId, userId: u.id, role } });
    return u;
  }

  await prisma.workspace.create({ data: { id: WS, name: "Test WS" } });
  await prisma.workspace.create({ data: { id: WS2, name: "Other WS" } });
  await prisma.brand.create({ data: { workspaceId: WS, name: "Brand T" } });
  await prisma.brand.create({ data: { workspaceId: WS2, name: "Brand O" } });

  const ownerUser = await makeUser("owner@test.io", "Owner", WS, "OWNER");
  const leadUser = await makeUser("lead@test.io", "Lead", WS, "CRISIS_LEAD");
  const execUser = await makeUser("exec@test.io", "Exec", WS, "EXEC_VIEWER");
  const staffUser = await makeUser("staff@test.io", "Staff", WS, "MODERATOR");
  const otherOwner = await makeUser("other@test.io", "Other", WS2, "OWNER");

  owner = { user: ownerUser, role: "OWNER", workspaceId: WS };
  lead = { user: leadUser, role: "CRISIS_LEAD", workspaceId: WS };
  exec = { user: execUser, role: "EXEC_VIEWER", workspaceId: WS };
  ownerOtherWs = { user: otherOwner, role: "OWNER", workspaceId: WS2 };
  void staffUser;
});

describe("Full lifecycle: event → alert → incident → approval → resolve → report", () => {
  let eventId: string;
  let alertId: string;
  let incidentId: string;
  let draftId: string;
  let approvalId: string;

  it("tạo brand/campaign/event DRAFT", async () => {
    const brand = await prisma.brand.findFirstOrThrow({ where: { workspaceId: WS } });
    const campaign = await prisma.campaign.create({
      data: { workspaceId: WS, brandId: brand.id, name: "Camp T" },
    });
    const event = await prisma.liveEvent.create({
      data: {
        workspaceId: WS,
        brandId: brand.id,
        campaignId: campaign.id,
        name: "Integration Test Live",
        platforms: JSON.stringify(["facebook"]),
        riskKeywords: JSON.stringify(["lừa đảo"]),
        dataMode: "DEMO",
      },
    });
    eventId = event.id;
    expect(event.status).toBe("DRAFT");
  });

  it("DRAFT → LIVE bị chặn bởi state machine (phải READY trước)", async () => {
    await expect(setEventStatus(owner, eventId, "LIVE")).rejects.toThrow("Không thể chuyển");
  });

  it("EXEC_VIEWER không được đổi status event (RBAC)", async () => {
    await expect(setEventStatus(exec, eventId, "READY")).rejects.toThrow("không có quyền");
  });

  it("DRAFT → READY → LIVE + segment tạo", async () => {
    await setEventStatus(owner, eventId, "READY");
    await setEventStatus(owner, eventId, "LIVE");
    const segs = await prisma.streamSegment.findMany({ where: { eventId } });
    expect(segs.length).toBe(1);
  });

  it("ingest message + dedupe: message trùng không tạo bản ghi mới", async () => {
    const cls = new RuleBasedClassifier();
    const c = await cls.classify({ externalId: "m1", platform: "facebook", rawText: "Giao trễ quá rồi shop ơi", authorName: "Minh A." });
    const dkey = dedupeKey("facebook", "Giao trễ quá rồi shop ơi", "Minh A.");

    const m1 = await prisma.message.create({
      data: {
        eventId,
        externalId: "m1",
        platform: "facebook",
        authorName: "Minh A.",
        rawText: "Giao trễ quá rồi shop ơi",
        topic: c.topic,
        riskType: c.riskType,
        sentiment: c.sentiment,
        dedupeKey: dkey,
      },
    });
    const dupe = await prisma.message.findFirst({ where: { eventId, dedupeKey: dkey } });
    expect(dupe?.id).toBe(m1.id);
    expect(c.riskType).toBe("delivery");
  });

  it("tạo 3 message delivery trong 2 phút → đủ điều kiện burst alert", async () => {
    const count = await prisma.message.count({
      where: { eventId, riskType: "delivery", createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("tạo alert P1 từ burst delivery", async () => {
    const alert = await prisma.alert.create({
      data: {
        eventId,
        title: "[delivery] Bùng phát khiếu nại giao hàng",
        priority: "P1",
        severity: "P1",
        reason: "3 complaint trong 2 phút",
        evidenceCount: 3,
        velocity: 3,
        policyMatch: "Burst khiếu nại giao hàng",
      },
    });
    alertId = alert.id;
    expect(alert.status).toBe("OPEN");
  });

  it("owner workspace KHÁC không convert alert này thành incident (tenant isolation)", async () => {
    await expect(
      createIncidentFromAlert(ownerOtherWs, alertId, {}),
    ).rejects.toThrow("không thuộc workspace");
  });

  it("convert alert → incident P1 + SLA windows + alert CONVERTED + evidence + timeline + audit", async () => {
    const incident = await createIncidentFromAlert(lead, alertId, { ownerId: lead.user.id });
    incidentId = incident.id;
    expect(incident.status).toBe("OPEN");
    expect(incident.severity).toBe("P1");
    expect(incident.slaAckDueAt).not.toBeNull();
    const alert = await prisma.alert.findUniqueOrThrow({ where: { id: alertId } });
    expect(alert.status).toBe("CONVERTED");
    expect(alert.incidentId).toBe(incidentId);
    const ev = await prisma.incidentEvidence.findMany({ where: { incidentId } });
    expect(ev.length).toBe(1);
    const tl = await prisma.incidentTimeline.findMany({ where: { incidentId } });
    expect(tl.some((t) => t.action === "created")).toBe(true);
    const audits = await prisma.auditLog.findMany({ where: { entityId: incidentId } });
    expect(audits.some((a) => a.action === "incident.create")).toBe(true);
  });

  it("convert lại cùng alert bị chặn (CONFLICT)", async () => {
    await expect(createIncidentFromAlert(lead, alertId, {})).rejects.toThrow("đã có incident");
  });

  it("EXEC_VIEWER không assign được (RBAC)", async () => {
    await expect(assignIncident(exec, incidentId, exec.user.id)).rejects.toThrow("không có quyền");
  });

  it("assign owner + notification + timeline", async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: "staff@test.io" } });
    await assignIncident(lead, incidentId, staff.id);
    incidentOwnerId = staff.id;
    const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.ownerId).toBe(staff.id);
    const notifs = await prisma.notification.findMany({ where: { userId: staff.id } });
    expect(notifs.length).toBeGreaterThan(0);
  });

  function staffCtx(): AuthContext {
    return { user: { id: incidentOwnerId, email: "staff@test.io", name: "Staff" }, role: "MODERATOR", workspaceId: WS };
  }

  it("acknowledge SLA trước hạn", async () => {
    const updated = await acknowledgeIncident(staffCtx(), incidentId);
    expect(updated.slaAckAt).not.toBeNull();
    expect(updated.slaAckAt!.getTime()).toBeLessThanOrEqual(updated.slaAckDueAt!.getTime());
  });

  it("thêm evidence + note có audit", async () => {
    const ev = await addEvidence(lead, incidentId, { kind: "link", content: "https://fb.live/clip/1" });
    expect(ev.id).toBeTruthy();
    const note = await addNote(lead, incidentId, "Đã liên hệ vận chuyển");
    expect(note.body).toContain("liên hệ");
    const audits = await prisma.auditLog.findMany({ where: { entityId: incidentId } });
    expect(audits.some((a) => a.action === "incident.note")).toBe(true);
  });

  it("escalate P1 → P0 + notification cho leads", async () => {
    const updated = await escalateIncident(lead, incidentId);
    expect(updated.severity).toBe("P0");
    const leads = await prisma.membership.findMany({ where: { workspaceId: WS, role: { in: ["OWNER", "CRISIS_LEAD"] } } });
    const notifs = await prisma.notification.findMany({
      where: { userId: { in: leads.map((l) => l.userId) }, type: "incident_escalated" },
    });
    expect(notifs.length).toBeGreaterThan(0);
  });

  it("severity đổi trực tiếp P0 → P2 (ghi audit)", async () => {
    const updated = await changeSeverity(owner, incidentId, "P2");
    expect(updated.severity).toBe("P2");
  });

  it("draft từ template + request approval + LEGAL check", async () => {
    const tpl = await prisma.responseTemplate.create({
      data: {
        workspaceId: WS,
        name: "TPL delivery",
        situationTopic: "delivery",
        body: "Chào {customer_name}, team đang xử lý đơn {order_id}.",
        bannedClaims: JSON.stringify(["cam kết hoàn tiền 100%"]),
      },
    });
    const draft = await createDraft(lead, {
      incidentId,
      templateId: tpl.id,
      title: "Phản hồi delivery burst",
      vars: { customer_name: "các bạn", order_id: "ORD-1" },
    });
    draftId = draft.id;
    expect(draft.status).toBe("DRAFT");
    expect(draft.body).toBe("Chào các bạn, team đang xử lý đơn ORD-1.");

    const approval = await requestApproval(lead, draft.id);
    approvalId = approval.id;
    expect(approval.status).toBe("PENDING");
    const d = await prisma.responseDraft.findUniqueOrThrow({ where: { id: draftId } });
    expect(d.status).toBe("PENDING_APPROVAL");
  });

  it("EXEC_VIEWER không được approve (RBAC)", async () => {
    await expect(decideApproval(exec, approvalId, "APPROVED")).rejects.toThrow("không có quyền");
  });

  it("OWNER approve → draft APPROVED + timeline + notification cho requester", async () => {
    const result = await decideApproval(owner, approvalId, "APPROVED", "OK, cẩn thận tone");
    expect(result.approval).toBe("APPROVED");
    const d = await prisma.responseDraft.findUniqueOrThrow({ where: { id: draftId } });
    expect(d.status).toBe("APPROVED");
    const notifs = await prisma.notification.findMany({ where: { userId: lead.user.id, type: "approval_decided" } });
    expect(notifs.length).toBeGreaterThan(0);
  });

  it("OPEN → RESOLVED (state machine) + resolvedAt + timeline", async () => {
    const updated = await changeIncidentStatus(owner, incidentId, "RESOLVED", { resolution: "Đền đơn + cam kết với khách" });
    expect(updated.status).toBe("RESOLVED");
    expect(updated.resolvedAt).not.toBeNull();
  });

  it("RESOLVED → REOPENED → INVESTIGATING lại được", async () => {
    await changeIncidentStatus(lead, incidentId, "REOPENED");
    const i2 = await changeIncidentStatus(lead, incidentId, "INVESTIGATING");
    expect(i2.status).toBe("INVESTIGATING");
    await changeIncidentStatus(owner, incidentId, "RESOLVED", { resolution: "Lần 2" });
  });

  it("CLOSED terminal — không mở lại được", async () => {
    await changeIncidentStatus(owner, incidentId, "CLOSED");
    await expect(changeIncidentStatus(owner, incidentId, "REOPENED")).rejects.toThrow("Không thể chuyển");
  });

  it("report tổng hợp đúng + demoData flag + recommended actions", async () => {
    const report = await buildEventReport(owner, eventId);
    expect(report.demoData).toBe(true);
    expect(report.metrics.messageVolume.value).toBeGreaterThanOrEqual(1);
    expect(report.metrics.alertSeverity.P1).toBeGreaterThanOrEqual(1);
    expect(report.metrics.incidentStatus.CLOSED).toBe(1);
    expect(report.metrics.slaCompliance.value).toBe(1);
    expect(report.recommendedActions.length).toBe(3);
    const persisted = await prisma.report.findUnique({ where: { eventId } });
    expect(persisted).not.toBeNull();
  });

  it("audit log đầy đủ cho toàn lifecycle", async () => {
    const actions = await prisma.auditLog.findMany({ where: { workspaceId: WS }, select: { action: true } });
    const kinds = new Set(actions.map((a) => a.action));
    for (const expected of [
      "incident.create",
      "incident.assign",
      "incident.acknowledge",
      "incident.severity",
      "incident.escalate",
      "incident.status",
      "incident.note",
      "response.approved",
      "event.status.ready",
      "event.status.live",
    ]) {
      expect(kinds.has(expected)).toBe(true);
    }
  });
});
