import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";
import { assertEventTransition } from "@/lib/state-machines";
import { assertCanAct } from "@/server/services/incidents";
import type { AuthContext } from "@/lib/auth";
import type { EventStatus } from "@/lib/constants";
import { startSimulator, stopSimulator, pauseSimulator, resumeSimulator } from "@/lib/crisis/simulator";

export async function setEventStatus(ctx: AuthContext, eventId: string, to: EventStatus) {
  assertCanAct(ctx, "event.status");
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy event");
  assertEventTransition(event.status as EventStatus, to);

  const data: Record<string, unknown> = { status: to };
  if (to === "LIVE") {
    data.startedAt = new Date();
    await prisma.streamSegment.create({ data: { eventId, name: `Segment ${new Date().toISOString().slice(11, 16)}` } });
  }
  if (to === "ENDED" || to === "CANCELLED") {
    data.endedAt = new Date();
    if (event.simState !== "STOPPED") await stopSimulator(eventId);
  }
  const updated = await prisma.liveEvent.update({ where: { id: eventId }, data });
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: `event.status.${to.toLowerCase()}`,
    entityType: "live_event",
    entityId: eventId,
    detail: { from: event.status, to },
  });
  return updated;
}

export async function simulatorControl(
  ctx: AuthContext,
  eventId: string,
  action: "start" | "pause" | "resume" | "stop",
) {
  assertCanAct(ctx, "event.simulator");
  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.workspaceId !== ctx.workspaceId) throw notFound("Không tìm thấy event");
  if (event.dataMode !== "DEMO") throw conflict("Event này dùng dataMode LIVE — không điều khiển simulator");
  await audit({
    workspaceId: ctx.workspaceId,
    actorId: ctx.user.id,
    action: `event.simulator.${action}`,
    entityType: "live_event",
    entityId: eventId,
  });
  switch (action) {
    case "start":
      return startSimulator(eventId);
    case "pause":
      return pauseSimulator(eventId);
    case "resume":
      return resumeSimulator(eventId);
    case "stop":
      return stopSimulator(eventId);
  }
}
