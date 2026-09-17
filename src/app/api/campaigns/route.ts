import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "workspace.view");
    const items = await prisma.campaign.findMany({
      where: { workspaceId },
      include: { brand: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  name: z.string().min(2).max(120),
  objective: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    const input = parseBody(schema, await req.json());
    const ctx = await requirePermission(input.workspaceId, "campaign.manage");
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
    if (!brand || brand.workspaceId !== input.workspaceId) return fail(new Error("Brand không thuộc workspace"));
    const campaign = await prisma.campaign.create({
      data: { workspaceId: input.workspaceId, brandId: input.brandId, name: input.name, objective: input.objective },
    });
    await audit({ workspaceId: input.workspaceId, actorId: ctx.user.id, action: "campaign.create", entityType: "campaign", entityId: campaign.id });
    return ok(campaign, 201);
  } catch (e) {
    return fail(e);
  }
}
