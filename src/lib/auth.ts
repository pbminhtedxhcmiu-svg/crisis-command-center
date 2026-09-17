import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { unauthenticated, forbidden, notFound } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/constants";
import { can, type PermissionAction } from "@/lib/rbac";

// ---- Password: scrypt (built-in node, không cần native deps) ----
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---- Session ----
export const SESSION_COOKIE = "ccc_session";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export async function createSession(userId: string) {
  const token = `${randomUUID()}.${randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}

export type AuthContext = {
  user: { id: string; email: string; name: string | null };
  role: WorkspaceRole;
  workspaceId: string;
};

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) throw unauthenticated();
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) throw unauthenticated("Phiên đăng nhập đã hết hạn");
  return session.user;
}

export async function requireUser() {
  return getCurrentUser();
}

// Bước 2 của guard: yêu cầu là member của workspace
export async function requireMember(workspaceId: string): Promise<AuthContext> {
  const user = await getCurrentUser();
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!membership) throw forbidden("Bạn không thuộc workspace này");
  return { user, role: membership.role as WorkspaceRole, workspaceId };
}

export async function requirePermission(
  workspaceId: string,
  action: PermissionAction,
): Promise<AuthContext> {
  const ctx = await requireMember(workspaceId);
  if (!can(ctx.role, action)) {
    throw forbidden(`Vai trò ${ctx.role} không có quyền ${action}`);
  }
  return ctx;
}

// Object-level guard: entity phải thuộc đúng workspace
export async function requireEventInWorkspace(eventId: string, workspaceId: string) {
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("Không tìm thấy event");
  if (event.workspaceId !== workspaceId) throw forbidden("Event không thuộc workspace của bạn");
  return event;
}

export async function requireIncidentInWorkspace(incidentId: string, workspaceId: string) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw notFound("Không tìm thấy incident");
  if (incident.workspaceId !== workspaceId) throw forbidden("Incident không thuộc workspace của bạn");
  return incident;
}
