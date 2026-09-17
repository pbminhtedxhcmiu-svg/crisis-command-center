import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail } from "@/lib/http";
import { getSimulatorState } from "@/lib/crisis/simulator";

type Params = { params: Promise<{ eventId: string }> };

// GET /api/live-events/:id/messages?platform=&topic=&risk=&q=&sort=newest|priority&limit=&cursor=
export async function GET(req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    await requirePermission(event.workspaceId, "alert.view");

    const url = new URL(req.url);
    const platform = url.searchParams.get("platform");
    const topic = url.searchParams.get("topic");
    const risk = url.searchParams.get("risk");
    const q = url.searchParams.get("q");
    const sort = url.searchParams.get("sort") ?? "newest";
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "40", 10) || 40, 100);
    const cursor = url.searchParams.get("cursor");

    const messages = await prisma.message.findMany({
      where: {
        eventId,
        ...(platform ? { platform } : {}),
        ...(topic ? { topic } : {}),
        ...(risk ? { riskType: risk } : {}),
        ...(q ? { rawText: { contains: q } } : {}),
      },
      orderBy: sort === "priority" ? [{ riskType: "asc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const sim = await getSimulatorState(eventId);
    return ok({ items: messages, sim, eventStatus: event.status, dataMode: event.dataMode });
  } catch (e) {
    return fail(e);
  }
}
