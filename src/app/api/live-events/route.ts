import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { conflict, notFound } from "@/lib/errors";

const createSchema = z.object({
  name: z.string().min(3).max(120),
  brandId: z.string().min(1),
  campaignId: z.string().nullish(),
  scheduledAt: z.string().datetime().nullish(),
  platforms: z.array(z.string()).min(1).max(4),
  products: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        offer: z.string().max(200).optional(),
        category: z.enum(PRODUCT_CATEGORIES).optional(),
      }),
    )
    .max(20)
    .nullish(),
  playbookId: z.string().nullish(),
  riskKeywords: z.array(z.string().max(60)).max(50).nullish(),
  hostUserId: z.string().nullish(),
  producerUserId: z.string().nullish(),
  oncallUserIds: z.array(z.string()).max(20).nullish(),
  escalationUserId: z.string().nullish(),
  dataMode: z.enum(["DEMO", "LIVE"]).default("DEMO"),
});

function serialize(e: {
  platforms: string;
  products: string | null;
  riskKeywords: string;
  oncallUserIds: string;
  [k: string]: unknown;
}) {
  return {
    ...e,
    platforms: JSON.parse(e.platforms) as string[],
    products: e.products ? JSON.parse(e.products) : [],
    riskKeywords: JSON.parse(e.riskKeywords) as string[],
    oncallUserIds: JSON.parse(e.oncallUserIds) as string[],
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [], nextCursor: null });
    await requirePermission(workspaceId, "event.view");

    const status = url.searchParams.get("status");
    const brandId = url.searchParams.get("brandId");
    const q = url.searchParams.get("q");
    const platform = url.searchParams.get("platform");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);
    const cursor = url.searchParams.get("cursor");

    const statuses = status ? status.split(",").filter(Boolean) : null;
    const events = await prisma.liveEvent.findMany({
      where: {
        workspaceId,
        ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
        ...(brandId ? { brandId } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      include: {
        brand: { select: { name: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const filtered = platform ? events.filter((e) => (JSON.parse(e.platforms) as string[]).includes(platform)) : events;
    return ok({
      items: filtered.map(serialize),
      nextCursor: events.length === limit ? events[events.length - 1].id : null,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const input = parseBody(createSchema, await req.json());
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
    const workspaceId = brand?.workspaceId;
    if (!workspaceId) throw notFound("Brand không tồn tại");
    const ctx = await requirePermission(workspaceId, "event.create");

    if (input.campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId } });
      if (!campaign || campaign.workspaceId !== workspaceId) throw conflict("Campaign không thuộc workspace");
    }
    const event = await prisma.liveEvent.create({
      data: {
        workspaceId,
        brandId: input.brandId,
        campaignId: input.campaignId ?? null,
        name: input.name,
        status: "DRAFT",
        dataMode: input.dataMode,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        platforms: JSON.stringify(input.platforms),
        products: input.products ? JSON.stringify(input.products) : null,
        playbookId: input.playbookId ?? null,
        riskKeywords: JSON.stringify(input.riskKeywords ?? []),
        hostUserId: input.hostUserId ?? null,
        producerUserId: input.producerUserId ?? null,
        oncallUserIds: JSON.stringify(input.oncallUserIds ?? []),
        escalationUserId: input.escalationUserId ?? null,
      },
    });
    await audit({
      workspaceId,
      actorId: ctx.user.id,
      action: "event.create",
      entityType: "live_event",
      entityId: event.id,
      detail: { name: event.name, dataMode: event.dataMode },
    });
    return ok(serialize(event), 201);
  } catch (e) {
    return fail(e);
  }
}
