import { destroySession, getSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) await destroySession(token);
    const res = ok({ success: true });
    res.cookies.set(SESSION_COOKIE, "", { expires: new Date(0), path: "/" });
    return res;
  } catch (e) {
    return fail(e);
  }
}
