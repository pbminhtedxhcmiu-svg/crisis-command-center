import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody, idempotent } from "@/lib/http";
import { createIncidentFromAlert } from "@/server/services/incidents";
import { audit } from "@/lib/audit";
import type { Priority } from "@/lib/constants";

type Params = { params: Promise<{ eventId: string }> };

async function eventWorkspace(eventId: string): Promise<string> {
  const e = await prisma.liveEvent.findUnique({ where: { id: eventId }, select: { workspaceId: true } });
  if (!e) throw notFound("Không tìm thấy event");
  return e.workspaceId;
}

// GET /api/live-events/:id/alerts
export async function GET(req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const wsId = await eventWorkspace(eventId);
    await requirePermission(wsId, "alert.view");
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");

    const items = await prisma.alert.findMany({
      where: {
        eventId,
        ...(status ? { status: { in: status.split(",").filter(Boolean) } } : {}),
        ...(priority ? { priority: { in: priority.split(",").filter(Boolean) } } : {}),
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const actionSchema = z.object({
  action: z.enum(["acknowledge", "assign", "snooze", "dismiss", "create-incident"]),
  alertId: z.string().min(1),
  userId: z.string().optional(),
  snoozeMinutes: z.number().int().min(1).max(240).optional(),
  requestKey: z.string().max(80).optional(),
  incident: z
    .object({
      title: z.string().min(3).max(120).optional(),
      summary: z.string().max(500).optional(),
      severity: z.enum(["P0", "P1", "P2", "P3"]).optional(),
      ownerId: z.string().optional(),
    })
    .optional(),
});

// POST /api/live-events/:id/alerts — batch action endpoint (idempotent qua requestKey)
export async function POST(req: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const input = parseBody(actionSchema, await req.json());
    const alert = await prisma.alert.findUnique({ where: { id: input.alertId } });
    if (!alert || alert.eventId !== eventId) throw notFound("Không tìm thấy alert");
    const wsId = await eventWorkspace(alert.eventId);

    switch (input.action) {
      case "acknowledge": {
        const ctx = await requirePermission(wsId, "alert.acknowledge");
        return ok(
          await idempotent(input.requestKey, async () => {
            const updated = await prisma.alert
              .update({
                where: { id: alert.id },
                data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
              })
              .catch(() => prisma.alert.findUnique({ where: { id: alert.id } }));
            await audit({
              workspaceId: wsId,
              actorId: ctx.user.id,
              action: "alert.acknowledge",
              entityType: "alert",
              entityId: alert.id,
            });
            return updated;
          }),
        );
      }
      case "assign": {
        if (!input.userId) return fail(new Error("userId required"));
        const ctx = await requirePermission(wsId, "alert.assign");
        return ok(
          await idempotent(input.requestKey, async () => {
            const updated = await prisma.alert.update({
              where: { id: alert.id },
              data: { assigneeId: input.userId },
            });
            await audit({
              workspaceId: wsId,
              actorId: ctx.user.id,
              action: "alert.assign",
              entityType: "alert",
              entityId: alert.id,
              detail: { userId: input.userId },
            });
            return updated;
          }),
        );
      }
      case "snooze": {
        await requirePermission(wsId, "alert.dismiss");
        return ok(
          await idempotent(input.requestKey, () =>
            prisma.alert.update({
              where: { id: alert.id },
              data: {
                status: "SNOOZED",
                snoozedUntil: new Date(Date.now() + (input.snoozeMinutes ?? 10) * 60_000),
              },
            }),
          ),
        );
      }
      case "dismiss": {
        await requirePermission(wsId, "alert.dismiss");
        return ok(
          await idempotent(input.requestKey, () =>
            prisma.alert.update({ where: { id: alert.id }, data: { status: "DISMISSED" } }),
          ),
        );
      }
      case "create-incident": {
        const ctx = await requirePermission(wsId, "incident.create");
        return ok(
          await idempotent(input.requestKey, () =>
            createIncidentFromAlert(ctx, alert.id, {
              title: input.incident?.title,
              summary: input.incident?.summary,
              severity: input.incident?.severity as Priority | undefined,
              ownerId: input.incident?.ownerId,
              requestKey: input.requestKey,
            }),
          ),
        );
      }
    }
  } catch (e) {
    return fail(e);
  }
}
