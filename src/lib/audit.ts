import { prisma } from "@/lib/db";

// Audit log — KHÔNG BAO GIỜ ghi secret/token/password vào detail
export async function audit(opts: {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      workspaceId: opts.workspaceId ?? null,
      actorId: opts.actorId ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      detail: opts.detail ? JSON.stringify(opts.detail) : null,
    },
  });
}
