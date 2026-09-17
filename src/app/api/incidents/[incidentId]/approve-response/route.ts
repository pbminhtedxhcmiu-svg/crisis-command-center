import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody, idempotent } from "@/lib/http";
import { decideApproval } from "@/server/services/drafts";

type Params = { params: Promise<{ incidentId: string }> };

const schema = z.object({
  approvalId: z.string().min(1).optional(),
  draftId: z.string().min(1).optional(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional(),
  requestKey: z.string().max(80).optional(),
});

// POST /api/incidents/:id/approve-response (và /reject-response gom về decision)
export async function POST(req: Request, { params }: Params) {
  try {
    const { incidentId } = await params;
    const input = parseBody(schema, await req.json());
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw notFound("Không tìm thấy incident");
    await requirePermission(incident.workspaceId, "response.approve");

    const approval = input.approvalId
      ? await prisma.approval.findUnique({ where: { id: input.approvalId } })
      : input.draftId
        ? await prisma.approval.findFirst({ where: { draftId: input.draftId, status: "PENDING" }, orderBy: { createdAt: "desc" } })
        : null;
    if (!approval || approval.incidentId !== incidentId) {
      throw notFound("Không tìm thấy approval cho incident này");
    }
    const ctx = await requirePermission(incident.workspaceId, "response.approve");
    return ok(
      await idempotent(input.requestKey, () =>
        decideApproval(ctx, approval.id, input.decision, input.note),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
