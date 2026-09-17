import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken, requirePermission } from "@/lib/auth";
import { buildEventReport } from "@/server/services/reports";

export const dynamic = "force-dynamic";

const SEV_BADGE: Record<string, string> = {
  P0: "badge badge-p0",
  P1: "badge badge-p1",
  P2: "badge badge-p2",
  P3: "badge badge-p3",
};
const SEV_COLOR: Record<string, string> = {
  P0: "var(--p0)",
  P1: "var(--p1)",
  P2: "var(--p2)",
  P3: "var(--p3)",
};

function fmtMetric(v: number | null, note?: string): string {
  if (v === null) return note ?? "Not enough data";
  if (v < 90) return `${v}s`;
  return `${Math.round(v / 60)}m`;
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ workspaceId: string; eventId: string }>;
}) {
  const { workspaceId, eventId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.workspaceId !== workspaceId) {
    return (
      <div className="surface p-8 max-w-lg">
        <div className="badge badge-disconnected mb-3">404</div>
        <h1 className="font-bold mb-1">Không tìm thấy event</h1>
        <Link className="btn mt-3" href={`/workspaces/${workspaceId}/live-events`}>← Về danh sách</Link>
      </div>
    );
  }

  const ctx = await requirePermission(workspaceId, "report.view");
  const report = await buildEventReport(ctx, eventId);
  const m = report.metrics;
  const empty =
    m.messageVolume.value === 0 &&
    Object.values(m.alertSeverity).every((n) => n === 0) &&
    Object.keys(m.incidentStatus).length === 0;

  if (empty) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="breadcrumb mb-4">
          <Link href={`/workspaces/${workspaceId}/live-events`}>Live Events</Link>
          <span className="sep">/</span>
          <span className="crumb-current">{event.name}</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight mb-4">Post-event Report</h1>
        <div className="surface p-12 text-center grid-lines">
          <div className="text-4xl mb-3">📊</div>
          <div className="font-semibold mb-1">Chưa đủ dữ liệu để tạo báo cáo</div>
          <p className="text-dim text-[13px] mb-5 max-w-sm mx-auto">
            Report cần ít nhất message/alert/incident. Chạy demo stream trong Command Center rồi quay lại.
          </p>
          <Link className="btn btn-primary" href={`/workspaces/${workspaceId}/live-events/${eventId}/command-center`}>
            🎛 Mở Command Center
          </Link>
        </div>
      </div>
    );
  }

  const sevMax = Math.max(1, ...Object.values(m.alertSeverity));
  const topicMax = Math.max(1, ...m.topicShare.slice(0, 5).map((t) => t.count));
  const platMax = Math.max(1, ...m.platformShare.map((p) => p.count));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="breadcrumb mb-4">
        <Link href={`/workspaces/${workspaceId}/live-events`}>Live Events</Link>
        <span className="sep">/</span>
        <Link href={`/workspaces/${workspaceId}/live-events/${eventId}`}>{report.eventName}</Link>
        <span className="sep">/</span>
        <span className="crumb-current">Report</span>
      </div>

      {/* hero */}
      <div
        className="surface card-hover p-6 mb-4"
        style={{ background: "var(--gradient-panel)", borderColor: "color-mix(in srgb, var(--accent) 35%, var(--border))" }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Post-event Report</h1>
            <p className="text-dim text-[12.5px] mt-1">
              {report.brand}{report.campaign ? ` · ${report.campaign}` : ""} · {report.status}
            </p>
          </div>
          {report.demoData && <span className="badge badge-demo">DEMO DATA</span>}
        </div>
        <p className="text-[13.5px] leading-relaxed">{report.executiveSummary}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "MESSAGES", value: String(m.messageVolume.value ?? m.messageVolume.note ?? "—") },
          { label: "VELOCITY / 5M", value: String(m.messageVelocity.value ?? m.messageVelocity.note ?? "—") },
          { label: "DETECTION TIME", value: fmtMetric(m.detectionTime.value, m.detectionTime.note) },
          { label: "ACK TIME", value: fmtMetric(m.acknowledgeTime.value, m.acknowledgeTime.note) },
          { label: "FIRST RESPONSE", value: fmtMetric(m.firstResponseTime.value, m.firstResponseTime.note) },
          { label: "RESOLUTION", value: fmtMetric(m.resolutionTime.value, m.resolutionTime.note) },
          { label: "SLA ACK COMPLIANCE", value: m.slaCompliance.value === null ? "Not enough data" : `${Math.round(m.slaCompliance.value * 100)}%` },
          { label: "INCIDENTS", value: String(Object.values(m.incidentStatus).reduce((a, b) => a + b, 0)) },
        ].map((k) => (
          <div key={k.label} className="surface kpi-tile p-3.5">
            <div className="text-faint text-[10.5px] font-semibold mb-1.5">{k.label}</div>
            <div className="text-xl font-bold tabular truncate" title={k.value}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        {/* Severity bars */}
        <div className="surface p-4">
          <div className="text-[11px] text-faint font-semibold mb-3">ALERT THEO SEVERITY</div>
          <div className="space-y-2.5">
            {(["P0", "P1", "P2", "P3"] as const).map((p) => (
              <div key={p}>
                <div className="flex justify-between items-center text-[12px] mb-1">
                  <span className={SEV_BADGE[p]}>{p}</span>
                  <b className="tabular">{m.alertSeverity[p]}</b>
                </div>
                <div className="sla-track" style={{ height: 5 }}>
                  <div
                    className="sla-fill"
                    style={{ width: `${(m.alertSeverity[p] / sevMax) * 100}%`, background: SEV_COLOR[p] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-faint font-semibold mt-4 mb-2">INCIDENT THEO STATUS</div>
          <div className="space-y-1 text-[12.5px]">
            {Object.keys(m.incidentStatus).length === 0 ? (
              <span className="text-dim">—</span>
            ) : (
              Object.entries(m.incidentStatus).map(([s, n]) => (
                <div key={s} className="flex justify-between">
                  <span className="text-dim">{s}</span>
                  <b className="tabular">{n}</b>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Topics + platforms share bars */}
        <div className="surface p-4">
          <div className="text-[11px] text-faint font-semibold mb-3">TOP TOPICS</div>
          {m.topicShare.length === 0 ? (
            <span className="text-dim text-[12.5px]">Not enough data</span>
          ) : (
            <div className="space-y-2.5">
              {m.topicShare.slice(0, 5).map((t) => (
                <div key={t.topic}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span>{t.topic}</span>
                    <b className="tabular">{t.count} · {t.share}%</b>
                  </div>
                  <div className="sla-track" style={{ height: 5 }}>
                    <div className="sla-fill" style={{ width: `${(t.count / topicMax) * 100}%`, background: "var(--accent)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-faint font-semibold mt-4 mb-3">PLATFORM SHARE</div>
          {m.platformShare.length === 0 ? (
            <span className="text-dim text-[12.5px]">Not enough data</span>
          ) : (
            <div className="space-y-2.5">
              {m.platformShare.map((p) => (
                <div key={p.platform}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="badge badge-p3">{p.platform}</span>
                    <b className="tabular">{p.count} · {p.share}%</b>
                  </div>
                  <div className="sla-track" style={{ height: 5 }}>
                    <div className="sla-fill" style={{ width: `${(p.count / platMax) * 100}%`, background: "var(--info)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recommended actions */}
      <div className="surface p-4 mb-4">
        <div className="text-[11px] text-faint font-semibold mb-3">3 HÀNH ĐỘNG ĐỀ XUẤT</div>
        <ol className="space-y-2.5 text-[13.5px]">
          {report.recommendedActions.map((a, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="w-5.5 h-5.5 w-[22px] h-[22px] shrink-0 grid place-items-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--gradient-brand)", color: "#06121f" }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{a}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-[11px] text-faint mb-4">
        Báo cáo sinh lúc {new Date(report.generatedAt).toLocaleString("vi-VN")} · Định nghĩa metric: src/lib/crisis/metrics.ts ·
        Metric thiếu dữ liệu hiển thị &quot;Not enough data&quot; thay vì 0.
      </p>

      <div className="flex gap-2.5">
        <Link className="btn btn-ghost" href={`/workspaces/${workspaceId}/live-events/${eventId}`}>← Chi tiết event</Link>
        <Link className="btn btn-ghost" href={`/workspaces/${workspaceId}/live-events/${eventId}/command-center`}>🎛 Command Center</Link>
      </div>
    </div>
  );
}
