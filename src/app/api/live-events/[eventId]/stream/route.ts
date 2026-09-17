import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail } from "@/lib/http";
import { getSimulatorState } from "@/lib/crisis/simulator";
import { severityDistribution } from "@/lib/crisis/metrics";

// GET /api/live-events/:id/stream?sinceIso=
// Polling endpoint (client poll 3s). TODO(realtime): đổi sang SSE/WebSocket khi hạ tầng sẵn sàng.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
    if (!event) throw notFound("Không tìm thấy event");
    await requirePermission(event.workspaceId, "alert.view");

    const url = new URL(req.url);
    const sinceIso = url.searchParams.get("sinceIso");
    const since = sinceIso ? new Date(sinceIso) : new Date(Date.now() - 60_000);

    const [rawMessages, rawAlerts, recentMessages, prevMessages, slaBreached, topTopicRows] = await Promise.all([
      prisma.message.findMany({
        where: { eventId, createdAt: { gt: since } },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      prisma.alert.findMany({
        where: { eventId, status: { in: ["OPEN", "SNOOZED", "ACKNOWLEDGED"] } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 30,
      }),
      prisma.message.findMany({
        where: { eventId, createdAt: { gte: new Date(Date.now() - 5 * 60_000) } },
        select: { createdAt: true, topic: true },
      }),
      prisma.message.findMany({
        where: { eventId, createdAt: { gte: new Date(Date.now() - 10 * 60_000), lt: new Date(Date.now() - 5 * 60_000) } },
        select: { id: true },
      }),
      prisma.incident.count({
        where: {
          eventId,
          OR: [
            { slaAckAt: null, slaAckDueAt: { lt: new Date() }, status: { notIn: ["RESOLVED", "CLOSED"] } },
            { resolvedAt: null, slaActionDueAt: { lt: new Date() }, status: { notIn: ["RESOLVED", "CLOSED"] } },
          ],
        },
      }),
      prisma.message.groupBy({
        by: ["topic"],
        where: { eventId, createdAt: { gte: new Date(Date.now() - 5 * 60_000) }, topic: { not: "other" } },
        _count: { topic: true },
        orderBy: { _count: { topic: "desc" } },
        take: 1,
      }),
    ]);

    const simState = await getSimulatorState(eventId);
    const simAlive = simState.state === "RUNNING" || simState.state === "PAUSED";
    const openIncidents = await prisma.incident.count({
      where: { eventId, status: { in: ["OPEN", "INVESTIGATING", "RESPONSE_PENDING", "RESPONDING", "MONITORING"] } },
    });

    const messages = rawMessages.map((m) => ({
      id: m.id,
      platform: m.platform,
      authorName: m.authorName,
      maskedName: m.authorMasked ? maskName(m.authorName) : m.authorName,
      text: m.rawText,
      lang: m.language,
      likes: parseLikes(m.engagement),
      topic: m.topic,
      riskType: m.riskType === "none" ? null : m.riskType,
      sentiment: m.sentiment,
      createdAt: m.createdAt.toISOString(),
    }));

    const alerts = rawAlerts.map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      reason: a.reason,
      evidenceCount: a.evidenceCount,
      velocity: a.velocity,
      status: a.status,
      assigneeId: a.assigneeId,
      createdAt: a.createdAt.toISOString(),
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    }));

    const alertsByPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const a of rawAlerts) if (a.priority in alertsByPriority) alertsByPriority[a.priority] += 1;

    const velocity = recentMessages.length / 5;

    return ok({
      serverTime: new Date().toISOString(),
      event: { id: event.id, status: event.status, dataMode: event.dataMode },
      eventStatus: event.status,
      sim: { running: simState.state === "RUNNING", paused: simState.state === "PAUSED", tick: simState.tick },
      dataMode: simAlive ? event.dataMode : "DISCONNECTED",
      messages,
      alerts,
      kpi: {
        messagesLast5m: recentMessages.length,
        messagesPrev5m: prevMessages.length,
        velocity: Math.round(velocity * 10) / 10,
        alertsOpen: alertsByPriority.P0 + alertsByPriority.P1 + alertsByPriority.P2 + alertsByPriority.P3,
        alertsByPriority,
        openIncidents,
        slaBreached,
        topTopic: topTopicRows[0]?.topic ?? null,
      },
      severityDistribution: severityDistribution(rawAlerts),
    });
  } catch (e) {
    return fail(e);
  }
}

function maskName(name: string): string {
  const n = name.trim();
  if (n.length <= 2) return `${n[0] ?? "?"}***`;
  return `${n.slice(0, 2)}***`;
}

function parseLikes(engagement: string): number {
  try {
    const e = JSON.parse(engagement) as { likes?: number };
    return typeof e.likes === "number" ? e.likes : 0;
  } catch {
    return 0;
  }
}
