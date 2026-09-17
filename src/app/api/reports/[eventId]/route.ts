import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail } from "@/lib/http";
import { buildEventReport } from "@/server/services/reports";

// GET /api/reports/:eventId
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    const ctx = await requirePermission(event.workspaceId, "report.view");
    const report = await buildEventReport(ctx, eventId);
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
