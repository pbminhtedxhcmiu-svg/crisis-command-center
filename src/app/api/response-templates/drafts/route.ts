import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, parseBody, idempotent } from "@/lib/http";
import { createDraft, requestApproval } from "@/server/services/drafts";

// GET /api/response-templates/drafts?workspaceId=&incidentId=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "draft.create");
    const incidentId = url.searchParams.get("incidentId");
    const items = await prisma.responseDraft.findMany({
      where: { workspaceId, ...(incidentId ? { incidentId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  action: z.literal("create"),
  workspaceId: z.string(),
  incidentId: z.string().optional(),
  templateId: z.string().optional(),
  title: z.string().min(2).max(120),
  body: z.string().max(2000).optional(),
  kind: z.enum(["comment_reply", "host_notice", "internal_notice"]).optional(),
  vars: z.record(z.string()).optional(),
  requestKey: z.string().max(80).optional(),
});

const requestSchema = z.object({
  action: z.literal("request-approval"),
  workspaceId: z.string(),
  draftId: z.string(),
  requestKey: z.string().max(80).optional(),
});

const union = z.discriminatedUnion("action", [createSchema, requestSchema]);

// POST /api/response-templates/drafts — action create | request-approval
export async function POST(req: Request) {
  try {
    const input = parseBody(union, await req.json());
    if (input.action === "create") {
      const ctx = await requirePermission(input.workspaceId, "draft.create");
      return ok(
        await idempotent(input.requestKey, () =>
          createDraft(ctx, {
            incidentId: input.incidentId,
            templateId: input.templateId,
            title: input.title,
            body: input.body,
            kind: input.kind,
            vars: input.vars,
          }),
        ),
        201,
      );
    }
    // request-approval
    const ctx = await requirePermission(input.workspaceId, "draft.requestApproval");
    return ok(await idempotent(input.requestKey, () => requestApproval(ctx, input.draftId, input.requestKey)), 201);
  } catch (e) {
    return fail(e);
  }
}
