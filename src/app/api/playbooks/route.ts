import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

// GET /api/playbooks?workspaceId=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "workspace.view");
    const items = await prisma.playbook.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}
