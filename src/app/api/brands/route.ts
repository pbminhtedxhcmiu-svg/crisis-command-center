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
    const items = await prisma.brand.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.object({ workspaceId: z.string(), name: z.string().min(2).max(80), description: z.string().max(300).optional() });

export async function POST(req: Request) {
  try {
    const input = parseBody(schema, await req.json());
    const ctx = await requirePermission(input.workspaceId, "brand.manage");
    const brand = await prisma.brand.create({ data: { workspaceId: input.workspaceId, name: input.name, description: input.description } });
    await audit({ workspaceId: input.workspaceId, actorId: ctx.user.id, action: "brand.create", entityType: "brand", entityId: brand.id });
    return ok(brand, 201);
  } catch (e) {
    return fail(e);
  }
}
