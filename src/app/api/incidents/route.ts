import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, parseBody } from "@/lib/http";
import { createIncidentManual } from "@/server/services/incidents";
import type { Priority } from "@/lib/constants";

// GET /api/incidents?workspaceId=&eventId=&status=&severity=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "incident.view");
    const eventId = url.searchParams.get("eventId");
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");

    const items = await prisma.incident.findMany({
      where: {
        workspaceId,
        ...(eventId ? { eventId } : {}),
        ...(status ? { status: { in: status.split(",").filter(Boolean) } } : {}),
        ...(severity ? { severity: { in: severity.split(",").filter(Boolean) } } : {}),
      },
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  eventId: z.string().min(1),
  title: z.string().min(3).max(120),
  summary: z.string().max(500).optional(),
  severity: z.enum(["P0", "P1", "P2", "P3"]),
  ownerId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const input = parseBody(createSchema, await req.json());
    const ctx = await requirePermission(input.workspaceId, "incident.create");
    const incident = await createIncidentManual(ctx, input.eventId, {
      title: input.title,
      summary: input.summary,
      severity: input.severity as Priority,
      ownerId: input.ownerId,
    });
    return ok(incident, 201);
  } catch (e) {
    return fail(e);
  }
}
