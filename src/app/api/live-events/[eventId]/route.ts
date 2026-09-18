import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notFound, conflict } from "@/lib/errors";
import { PLATFORMS } from "@/lib/constants";

type Params = { params: Promise<{ eventId: string }> };

/** Schema URL linkstream: bắt buộc http(s), giới hạn độ dài hợp lý. */
const streamUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "URL phải là http/https")
  .optional()
  .or(z.literal(""));

const streamUrlsSchema = z
  .record(z.enum(PLATFORMS), streamUrlSchema)
  .optional()
  .transform((v) =>
    v
      ? Object.fromEntries(
          Object.entries(v).filter(([, url]) => typeof url === "string" && url.trim() !== ""),
        )
      : undefined,
  );

export async function GET(_req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    await requirePermission(event.workspaceId, "event.view");

    const [policyCount, templateCount, memberCount] = await Promise.all([
      prisma.policyRule.count({ where: { workspaceId: event.workspaceId, enabled: true } }),
      prisma.responseTemplate.count({ where: { workspaceId: event.workspaceId, status: "ACTIVE" } }),
      prisma.membership.count({ where: { workspaceId: event.workspaceId } }),
    ]);
    const oncall = JSON.parse(event.oncallUserIds) as string[];
    const keywords = JSON.parse(event.riskKeywords) as string[];
    const readiness = {
      hasOwner: Boolean(event.hostUserId || event.producerUserId),
      hasDataSource: event.dataMode === "DEMO" || true, // DEMO luôn có simulator; LIVE cần connector
      hasSeverityPolicy: policyCount > 0,
      hasEscalation: Boolean(event.escalationUserId) || oncall.length > 0,
      hasResponseTemplate: templateCount > 0,
      hasApprover: memberCount > 0,
      hasKeywordRule: keywords.length > 0,
    };
    const ready = Object.values(readiness).every(Boolean);

    return ok({
      event: {
        ...event,
        platforms: JSON.parse(event.platforms),
        streamUrls: JSON.parse(event.streamUrls) as Record<string, string>,
        products: event.products ? JSON.parse(event.products) : [],
        riskKeywords: keywords,
        oncallUserIds: oncall,
      },
      readiness: { ...readiness, ready },
    });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  scheduledAt: z.string().datetime().nullish(),
  platforms: z.array(z.string()).min(1).max(4).optional(),
  streamUrls: streamUrlsSchema,
  products: z.array(z.object({ name: z.string(), offer: z.string().optional(), category: z.string().optional() })).optional(),
  riskKeywords: z.array(z.string()).optional(),
  hostUserId: z.string().nullish(),
  producerUserId: z.string().nullish(),
  oncallUserIds: z.array(z.string()).optional(),
  escalationUserId: z.string().nullish(),
  playbookId: z.string().nullish(),
  simSeed: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const input = parseBody(patchSchema, await req.json());
    const existing = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!existing) throw notFound("Không tìm thấy event");
    const ctx = await requirePermission(existing.workspaceId, "event.update");

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (input.platforms !== undefined) data.platforms = JSON.stringify(input.platforms);
    if (input.streamUrls !== undefined) {
      // streamUrls chỉ hợp lệ cho nền tảng của event (sau khi áp platforms mới nếu có)
      const effectivePlatforms = input.platforms ?? (JSON.parse(existing.platforms) as string[]);
      const unknown = Object.keys(input.streamUrls).filter((p) => !effectivePlatforms.includes(p));
      if (unknown.length > 0) throw conflict(`streamUrls chứa nền tảng không thuộc event: ${unknown.join(", ")}`);
      data.streamUrls = JSON.stringify(input.streamUrls);
    }
    if (input.products !== undefined) data.products = JSON.stringify(input.products);
    if (input.riskKeywords !== undefined) data.riskKeywords = JSON.stringify(input.riskKeywords);
    if (input.hostUserId !== undefined) data.hostUserId = input.hostUserId;
    if (input.producerUserId !== undefined) data.producerUserId = input.producerUserId;
    if (input.oncallUserIds !== undefined) data.oncallUserIds = JSON.stringify(input.oncallUserIds);
    if (input.escalationUserId !== undefined) data.escalationUserId = input.escalationUserId;
    if (input.playbookId !== undefined) data.playbookId = input.playbookId;
    if (input.simSeed !== undefined) data.simSeed = input.simSeed;

    const event = await prisma.liveEvent.update({ where: { id: eventId }, data });
    await audit({
      workspaceId: ctx.workspaceId,
      actorId: ctx.user.id,
      action: "event.update",
      entityType: "live_event",
      entityId: eventId,
      detail: { fields: Object.keys(data) },
    });
    return ok({
      ...event,
      platforms: JSON.parse(event.platforms),
      streamUrls: JSON.parse(event.streamUrls) as Record<string, string>,
      products: event.products ? JSON.parse(event.products) : [],
      riskKeywords: JSON.parse(event.riskKeywords),
      oncallUserIds: JSON.parse(event.oncallUserIds),
    });
  } catch (e) {
    return fail(e);
  }
}
