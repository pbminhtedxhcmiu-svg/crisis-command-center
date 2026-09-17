import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true } } },
    });
    return ok({
      user: { id: user.id, email: user.email, name: user.name },
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
