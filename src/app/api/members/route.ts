import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

// GET /api/members?workspaceId=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "workspace.view");
    const items = await prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { role: "asc" },
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}
