import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody } from "@/lib/http";
import { setEventStatus } from "@/server/services/events";

const schema = z.object({ action: z.enum(["ready", "start", "end", "cancel"]) });

// POST /api/live-events/:id/status  {action: ready|start|end|cancel}
// (tương ứng POST /ready, /start, /end trong master contract)
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const { action } = parseBody(schema, await req.json());
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    const ctx = await requirePermission(event.workspaceId, "event.status");
    const map = { ready: "READY", start: "LIVE", end: "ENDED", cancel: "CANCELLED" } as const;
    const updated = await setEventStatus(ctx, eventId, map[action]);
    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}
