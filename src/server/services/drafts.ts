import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { assertDraftTransition } from "@/lib/state-machines";
import { approverRolesForDraft } from "@/lib/rbac";
import { assertCanAct } from "@/server/services/incidents";
import { findBannedClaims, renderTemplate } from "@/lib/crisis/template";
import type { AuthContext } from "@/lib/auth";
import type { DraftStatus } from "@/lib/constants";

// Response draft service — KHÔNG BAO GIỜ tự gửi công khai. Publish ngoài MVP.

async function bannedClaimsOf(templateId: string | null, body: string): Promise<string[]> {
  if (!templateId) return [];
  const tpl = await prisma.responseTemplate.findUnique({ where: { id: templateId } });
  return tpl ? findBannedClaims(body, JSON.parse(tpl.bannedClaims || "[]")) : [];
}

export async function createDraft(ctx: AuthContext, input: {
  incidentId?: string;
  templateId?: string;
  title: string;
  body?: string;
  kind?: string;
  vars?: Record<string, string>;
}) {
  assertCanAct(ctx, "draft.create");
  let body = input.body ?? "";
  if (input.templateId) {
    const tpl = await prisma.responseTemplate.findUnique({ where: { id: input.templateId } });
    if (!tpl || tpl.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy template");
    if (tpl.status !== "ACTIVE") throw conflict("Template đang INACTIVE");
    body = renderTemplate(tpl.body, input.vars ?? {});
  }
  const draft = await prisma.responseDraft.create({
    data: {
      workspaceId: ctx.workspaceId,
      incidentId: input.incidentId ?? null,
      templateId: input.templateId ?? null,
      authorId: ctx.user.id,
      title: input.title,
      body,
      kind: input.kind ?? "comment_reply",
      status: "DRAFT",
    },
  });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "draft.create",
    entityType: "response_draft",
    entityId: draft.id,
    detail: { incidentId: input.incidentId, templateId: input.templateId },
  });
  return draft;
}

export async function requestApproval(ctx: AuthContext, draftId: string, requestKey?: string) {
  assertCanAct(ctx, "draft.requestApproval");
  const draft = await prisma.responseDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy draft");
  assertDraftTransition(draft.status as DraftStatus, "PENDING_APPROVAL");

  const banned = await bannedClaimsOf(draft.templateId, draft.body);
  if (banned.length > 0) {
    throw conflict(`Draft chứa claim cấm: ${banned.join(", ")} — bắt buộc sửa trước hoặc Legal duyệt trực tiếp`);
  }

  const approval = await prisma.approval.create({
    data: {
      workspaceId: ctx.workspaceId,
      draftId: draft.id,
      incidentId: draft.incidentId,
      requesterId: ctx.user.id,
      status: "PENDING",
    },
  });
  await prisma.responseDraft.update({ where: { id: draft.id }, data: { status: "PENDING_APPROVAL", requestKey: requestKey ?? null } });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: "draft.requestApproval",
    entityType: "response_draft",
    entityId: draft.id,
    detail: { approvalId: approval.id },
  });
  const approvers = await prisma.membership.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      role: { in: approverRolesForDraft(banned.length) as string[] },
    },
    select: { userId: true },
  });
  if (approvers.length > 0) {
    await prisma.notification.createMany({
      data: approvers
        .filter((a) => a.userId !== ctx.user.id)
        .map((a) => ({
          workspaceId: ctx.workspaceId,
          userId: a.userId,
          title: "Có response draft chờ duyệt",
          body: draft.title,
          type: "approval_requested",
          refId: draft.id,
        })),
    });
  }
  return approval;
}

export async function decideApproval(ctx: AuthContext, approvalId: string, decision: "APPROVED" | "REJECTED", note?: string) {
  assertCanAct(ctx, "response.approve");
  const approval = await prisma.approval.findUnique({ where: { id: approvalId }, include: { draft: true } });
  if (!approval || approval.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy approval");
  if (approval.status !== "PENDING") throw conflict("Approval này đã được quyết");
  assertDraftTransition(approval.draft.status as DraftStatus, decision);

  const draftBanned = await bannedClaimsOf(approval.draft.templateId, approval.draft.body);
  if (decision === "APPROVED" && draftBanned.length > 0) {
    if (!["OWNER", "CRISIS_LEAD", "LEGAL_REVIEWER"].includes(ctx.role)) {
      throw forbidden("Draft chứa claim cấm — chỉ Legal/Crisis Lead/Owner được duyệt");
    }
  }

  await prisma.approval.update({
    where: { id: approvalId },
    data: { status: decision, decidedById: ctx.user.id, decisionNote: note, decidedAt: new Date() },
  });
  await prisma.responseDraft.update({
    where: { id: approval.draftId },
    data: { status: decision, rejectReason: decision === "REJECTED" ? note : null },
  });
  if (approval.incidentId) {
    await prisma.incidentTimeline.create({
      data: {
        incidentId: approval.incidentId,
        actorId: ctx.user.id,
        action: `response_${decision.toLowerCase()}`,
        detail: `Draft: ${approval.draft.title}`,
      },
    });
  }
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: `response.${decision.toLowerCase()}`,
    entityType: "response_draft",
    entityId: approval.draftId,
    detail: { approvalId, note },
  });
  await prisma.notification.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: approval.requesterId,
      title: `Draft của bạn đã ${decision === "APPROVED" ? "được duyệt" : "bị từ chối"}`,
      body: approval.draft.title,
      type: "approval_decided",
      refId: approval.draftId,
    },
  });
  return { approval: decision };
}
