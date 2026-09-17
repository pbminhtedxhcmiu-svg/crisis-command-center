import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { conflict } from "@/lib/errors";
import { ok, fail, parseBody, rateLimit } from "@/lib/http";
import { audit } from "@/lib/audit";
import { bootstrapWorkspaceStarterKit } from "@/server/services/bootstrap";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(72),
  workspaceName: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  try {
    rateLimit(req as never, "auth-register", 10);
    const input = parseBody(schema, await req.json());
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw conflict("Email đã được dùng");
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: hashPassword(input.password),
      },
    });
    // Mỗi user mới tạo 1 workspace riêng, role OWNER
    const wsName = input.workspaceName ?? `Workspace của ${input.name}`;
    const workspace = await prisma.workspace.create({ data: { name: wsName } });
    await prisma.membership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    });
    // Starter kit: brand + playbook + policy rules + templates + connections — dùng được ngay
    await bootstrapWorkspaceStarterKit(workspace.id);
    const { token, expiresAt } = await createSession(user.id);
    await audit({ workspaceId: workspace.id, actorId: user.id, action: "auth.register", entityType: "user", entityId: user.id });
    const res = ok({ user: { id: user.id, email: user.email, name: user.name }, workspaceId: workspace.id }, 201);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (e) {
    return fail(e);
  }
}
