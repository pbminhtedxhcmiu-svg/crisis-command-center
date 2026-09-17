import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody } from "@/lib/http";
import { simulatorControl } from "@/server/services/events";

const schema = z.object({ action: z.enum(["start", "pause", "resume", "stop"]) });

// POST /api/live-events/:id/simulator  {action: start|pause|resume|stop}
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const { action } = parseBody(schema, await req.json());
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    const ctx = await requirePermission(event.workspaceId, "event.simulator");
    const result = await simulatorControl(ctx, eventId, action);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
