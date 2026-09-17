import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail } from "@/lib/http";

type Params = { params: Promise<{ incidentId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { incidentId } = await params;
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw notFound("Không tìm thấy incident");
    await requirePermission(incident.workspaceId, "incident.view");

    const [assignments, evidence, notes, timeline, drafts, approvals, alerts] = await Promise.all([
      prisma.incidentAssignment.findMany({ where: { incidentId }, include: { user: { select: { id: true, name: true } } } }),
      prisma.incidentEvidence.findMany({ where: { incidentId }, orderBy: { createdAt: "asc" } }),
      prisma.incidentNote.findMany({ where: { incidentId }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } }),
      prisma.incidentTimeline.findMany({ where: { incidentId }, orderBy: { createdAt: "asc" } }),
      prisma.responseDraft.findMany({ where: { incidentId }, orderBy: { updatedAt: "desc" } }),
      prisma.approval.findMany({ where: { incidentId }, orderBy: { createdAt: "desc" } }),
      prisma.alert.findMany({ where: { incidentId } }),
    ]);
    return ok({ incident, assignments, evidence, notes, timeline, drafts, approvals, alerts });
  } catch (e) {
    return fail(e);
  }
}
