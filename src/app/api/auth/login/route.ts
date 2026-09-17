import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { unauthenticated } from "@/lib/errors";
import { ok, fail, parseBody, rateLimit } from "@/lib/http";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    rateLimit(req as never, "auth-login", 60);
    const input = parseBody(schema, await req.json());
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw unauthenticated("Email hoặc mật khẩu không đúng");
    }
    const { token, expiresAt } = await createSession(user.id);
    await audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id });
    const res = ok({ user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (e) {
    return fail(e);
  }
}
