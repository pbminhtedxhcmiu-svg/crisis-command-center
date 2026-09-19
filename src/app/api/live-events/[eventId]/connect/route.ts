import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";
import { connectTikTok, connectFacebook, disconnectConnector, getConnectorState } from "@/lib/crisis/connector";

type Params = { params: Promise<{ eventId: string }> };

// GET /api/live-events/:id/connect — trạng thái connector hiện tại
export async function GET(_req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId }, select: { workspaceId: true } });
    if (!event) throw notFound("Không tìm thấy event");
    await requirePermission(event.workspaceId, "event.view");
    return ok(getConnectorState(eventId));
  } catch (e) {
    return fail(e);
  }
}

const connectSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("connect"),
    platform: z.enum(["tiktok", "facebook"]),
    username: z.string().max(120).optional(), // TikTok: @username hoặc URL live
    videoId: z.string().max(120).optional(), // Facebook: videoId
    accessToken: z.string().min(10).max(2000).optional(), // Facebook: Page token (KHÔNG lưu DB)
  }),
  z.object({ action: z.literal("disconnect") }),
]);

// POST /api/live-events/:id/connect — connect/disconnect nguồn comment thật.
// Event phải LIVE và dataMode = LIVE (DEMO thì dùng simulator).
export async function POST(req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const input = parseBody(connectSchema, await req.json());
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    const ctx = await requirePermission(event.workspaceId, "event.simulator");

    if (input.action === "disconnect") {
      await disconnectConnector(eventId);
      await audit({
        workspaceId: event.workspaceId,
        actorId: ctx.user.id,
        action: "event.connector.disconnect",
        entityType: "live_event",
        entityId: eventId,
      });
      return ok(getConnectorState(eventId));
    }

    if (event.status !== "LIVE") throw new Error("Event chưa LIVE — hãy Start event trước khi kết nối");
    if (event.dataMode !== "LIVE") throw new Error("Event đang ở dataMode DEMO — hãy chuyển sang LIVE hoặc dùng simulator");

    const state =
      input.platform === "tiktok"
        ? await connectTikTok(eventId, input.username)
        : await connectFacebook(eventId, input.accessToken ?? "", input.videoId);

    // KHÔNG ghi token vào DB/audit — chỉ log hành động
    await audit({
      workspaceId: event.workspaceId,
      actorId: ctx.user.id,
      action: `event.connector.${input.platform}`,
      entityType: "live_event",
      entityId: eventId,
      detail: { source: state.source, status: state.status },
    });
    return ok(state, state.status === "ERROR" ? 502 : 200);
  } catch (e) {
    return fail(e);
  }
}
