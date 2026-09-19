import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ eventId: string }> };

// POST /api/live-events/:id/checklist — toggle 1 mục checklist trước live
// body: { itemId } → bật/tắt; trạng thái lưu LiveEvent.checklistState (map itemId→true)
const schema = z.object({ itemId: z.string().min(1) });

export async function POST(req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const { itemId } = parseBody(schema, await req.json());
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    const ctx = await requirePermission(event.workspaceId, "event.update");

    const state = JSON.parse(event.checklistState ?? "{}") as Record<string, boolean>;
    if (state[itemId]) delete state[itemId];
    else state[itemId] = true;

    const updated = await prisma.liveEvent.update({
      where: { id: eventId },
      data: { checklistState: JSON.stringify(state) },
    });
    await audit({
      workspaceId: ctx.workspaceId,
      actorId: ctx.user.id,
      action: "event.checklist.toggle",
      entityType: "live_event",
      entityId: eventId,
      detail: { itemId, checked: !!state[itemId] },
    });
    return ok({ checklistState: JSON.parse(updated.checklistState) as Record<string, boolean> });
  } catch (e) {
    return fail(e);
  }
}
