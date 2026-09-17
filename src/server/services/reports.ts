import { prisma } from "@/lib/db";
import {
  messageVolume,
  messageVelocity,
  severityDistribution,
  incidentStatusDistribution,
  detectionTime,
  acknowledgeTime,
  firstResponseTime,
  resolutionTime,
  topicShare,
  platformShare,
} from "@/lib/crisis/metrics";
import { slaCompliance } from "@/lib/sla";
import { notFound, forbidden } from "@/lib/errors";
import type { AuthContext } from "@/lib/auth";

// Post-event report — mọi số liệu có định nghĩa; thiếu dữ liệu → note not_enough_data.
// dataMode DEMO → gắn cờ demoData: true (UI hiển thị "Demo data").

export async function buildEventReport(ctx: AuthContext, eventId: string) {
  const event = await prisma.liveEvent.findUnique({
    where: { id: eventId },
    include: { brand: true, campaign: true },
  });
  if (!event) throw notFound("Không tìm thấy event");
  if (event.workspaceId !== ctx.workspaceId) throw forbidden("Event không thuộc workspace của bạn");

  const [messages, alerts, incidents, drafts] = await Promise.all([
    prisma.message.findMany({ where: { eventId }, select: { createdAt: true, topic: true, platform: true, sentiment: true } }),
    prisma.alert.findMany({ where: { eventId }, select: { priority: true, createdAt: true, acknowledgedAt: true } }),
    prisma.incident.findMany({
      where: { eventId },
      select: { status: true, severity: true, createdAt: true, resolvedAt: true, slaAckDueAt: true, slaAckAt: true, resolution: true },
    }),
    prisma.responseDraft.findMany({ where: { workspaceId: ctx.workspaceId }, select: { status: true, updatedAt: true, createdAt: true, incidentId: true } }),
  ]);

  const volume = messageVolume(messages);
  const velocity = messageVelocity(messages);
  const sla = slaCompliance(incidents);

  const recommendedActions: string[] = [];
  const sevDist = severityDistribution(alerts);
  if (sevDist.P0 > 0 || sevDist.P1 > 0) {
    recommendedActions.push("Rà soát quy trình duyệt claim sản phẩm trước giờ live — P0/P1 đã xuất hiện.");
  }
  if ((topicShare(messages)[0]?.topic ?? "") === "delivery") {
    recommendedActions.push("Chốt SLA với đơn vị vận chuyển và chuẩn bị template trả lời khiếu nại giao hàng.");
  }
  if (sla.ratio !== null && sla.ratio < 1) {
    recommendedActions.push("Bổ sung người trực khung giờ cao điểm để cải thiện SLA acknowledge.");
  }
  const genericPool = [
    "Chuẩn hoá thêm response template cho các topic xuất hiện nhiều nhất trong live.",
    "Xem lại ngưỡng velocity của policy rules dựa trên volume thực tế buổi live.",
    "Lên lịch rehearsal readiness checklist trước giờ live kế tiếp.",
  ];
  let gi = 0;
  while (recommendedActions.length < 3 && gi < genericPool.length) {
    recommendedActions.push(genericPool[gi++]);
  }

  const report = {
    eventId,
    eventName: event.name,
    brand: event.brand.name,
    campaign: event.campaign?.name ?? null,
    dataMode: event.dataMode,
    demoData: event.dataMode === "DEMO",
    status: event.status,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    executiveSummary:
      alerts.length === 0
        ? "Không có alert nào trong suốt buổi live."
        : `${alerts.length} alert được tạo, ${incidents.length} incident, SLA acknowledge ${sla.ratio === null ? "n/a" : `${Math.round(sla.ratio * 100)}%`}.`,
    metrics: {
      messageVolume: volume,
      messageVelocity: velocity,
      alertSeverity: sevDist,
      incidentStatus: incidentStatusDistribution(incidents),
      detectionTime: detectionTime(alerts, event.startedAt),
      acknowledgeTime: acknowledgeTime(alerts),
      firstResponseTime: firstResponseTime(drafts),
      resolutionTime: resolutionTime(incidents),
      slaCompliance: sla.ratio === null ? { value: null, note: "not_enough_data" } : { value: sla.ratio },
      topicShare: topicShare(messages),
      platformShare: platformShare(messages),
    },
    recommendedActions: recommendedActions.slice(0, 3),
    generatedAt: new Date().toISOString(),
  };

  await prisma.report.upsert({
    where: { eventId },
    create: { workspaceId: ctx.workspaceId, eventId, payload: JSON.stringify(report) },
    update: { payload: JSON.stringify(report) },
  });
  return report;
}
