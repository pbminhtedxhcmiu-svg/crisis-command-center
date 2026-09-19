"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CrisisEscalationBanner from "./CrisisEscalationBanner";

/* ---------- types (khớp contract GET /stream) ---------- */
type StreamMsg = {
  id: string;
  platform: string;
  maskedName: string;
  text: string;
  likes: number;
  topic: string | null;
  riskType: string | null;
  sentiment: string | null;
  createdAt: string;
};
type StreamAlert = {
  id: string;
  title: string;
  priority: string;
  reason: string;
  evidenceCount: number;
  velocity: number;
  status: string;
  assigneeId: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
};
type ConnectorState = {
  status: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  platform: string | null;
  source: string;
  connectedAt: string | null;
  lastMessageAt: string | null;
  ingested: number;
  error: string | null;
};
type StreamPayload = {
  serverTime: string;
  eventStatus: string;
  dataMode: string;
  sim: { running: boolean; paused: boolean; tick: number };
  connector?: ConnectorState;
  messages: StreamMsg[];
  alerts: StreamAlert[];
  kpi: {
    messagesLast5m: number;
    messagesPrev5m: number;
    velocity: number;
    alertsOpen: number;
    alertsByPriority: Record<string, number>;
    openIncidents: number;
    openP0Incidents?: number;
    slaBreached: number;
    topTopic: string | null;
  };
};

const PRIORITY_BADGE: Record<string, string> = {
  P0: "badge badge-p0",
  P1: "badge badge-p1",
  P2: "badge badge-p2",
  P3: "badge badge-p3",
};

const PLATFORM_META: Record<string, { label: string; cls: string }> = {
  facebook: { label: "Facebook", cls: "pf-facebook" },
  tiktok: { label: "TikTok", cls: "pf-tiktok" },
  shopee: { label: "Shopee", cls: "pf-shopee" },
  youtube: { label: "YouTube", cls: "pf-youtube" },
};

const TOPIC_EMOJI: Record<string, string> = {
  pricing: "💰",
  shipping: "🚚",
  delivery: "📦",
  product_claim: "🧪",
  spam: "🚫",
  praise: "❤️",
  product: "🛍",
  other: "💬",
};

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "vừa xong";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function slaMinutes(priority: string): number {
  return priority === "P0" ? 15 : priority === "P1" ? 30 : priority === "P2" ? 120 : 480;
}

export default function CommandCenterMonitor({
  workspaceId,
  eventId,
  eventName,
  eventStatus: initialStatus,
  dataMode: initialDataMode,
}: {
  workspaceId: string;
  eventId: string;
  eventName: string;
  eventStatus: string;
  dataMode: string;
}) {
  const [data, setData] = useState<StreamPayload | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [paused, setPaused] = useState(false);
  const [busyAlert, setBusyAlert] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [connBusy, setConnBusy] = useState(false);
  const [connPanel, setConnPanel] = useState(false);
  const [connPlatform, setConnPlatform] = useState<"tiktok" | "facebook">("tiktok");
  const [connUsername, setConnUsername] = useState("");
  const [connVideoId, setConnVideoId] = useState("");
  const [connToken, setConnToken] = useState("");
  const [connError, setConnError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [riskOnly, setRiskOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [panelAlert, setPanelAlert] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const pausedRef = useRef(false);
  pausedRef.current = paused;
  // Đóng băng polling khi panel xử lý alert đang mở → nút không di chuyển giữa chừng
  const panelOpenRef = useRef(false);
  panelOpenRef.current = panelAlert !== null;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-events/${eventId}/stream`, { cache: "no-store" });
      if (!res.ok) throw new Error(`stream ${res.status}`);
      const body = (await res.json()) as StreamPayload;
      setData(body);
      setLoadState("ok");
    } catch {
      setLoadState((s) => (s === "ok" ? "ok" : "error")); // giữ dữ liệu cũ nếu lỗi thoáng qua
    }
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    async function loop() {
      while (!cancelled) {
        if (!pausedRef.current && !panelOpenRef.current) await load();
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    void load();
    void loop();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Clock 1s cho countdown SLA + elapsed
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const eventStatus = data?.eventStatus ?? initialStatus;
  const dataMode = data?.dataMode ?? initialDataMode;
  const sim = data?.sim;
  const kpi = data?.kpi;

  const modeBadge =
    dataMode === "DISCONNECTED"
      ? "badge badge-disconnected"
      : dataMode === "DEMO"
        ? "badge badge-demo"
        : "badge badge-demo";

  const filteredMsgs = useMemo(() => {
    let m = data?.messages ?? [];
    if (platformFilter) m = m.filter((x) => x.platform === platformFilter);
    if (riskOnly) m = m.filter((x) => x.riskType);
    if (query.trim()) {
      const q = query.toLowerCase();
      m = m.filter((x) => x.text.toLowerCase().includes(q) || x.maskedName.toLowerCase().includes(q));
    }
    return m;
  }, [data, platformFilter, riskOnly, query]);

  async function simAction(action: "start" | "pause" | "resume" | "stop") {
    setSimBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/live-events/${eventId}/simulator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? `Lỗi ${res.status}`);
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Lỗi simulator");
    } finally {
      setSimBusy(false);
    }
  }

  async function connectorAction(action: "connect" | "disconnect") {
    setConnBusy(true);
    setConnError(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "connect") {
        body.platform = connPlatform;
        if (connPlatform === "tiktok") body.username = connUsername || undefined;
        else {
          body.videoId = connVideoId || undefined;
          body.accessToken = connToken;
        }
      }
      const res = await fetch(`/api/live-events/${eventId}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? json?.error ?? `Lỗi ${res.status}`);
      if (connPlatform === "facebook" && action === "connect") setConnToken(""); // không giữ token ở client
      await load();
    } catch (e) {
      setConnError(e instanceof Error ? e.message : "Lỗi kết nối");
    } finally {
      setConnBusy(false);
    }
  }

  async function alertAction(alertId: string, action: "acknowledge" | "snooze" | "dismiss" | "create-incident") {
    setBusyAlert(alertId);
    setActionError(null);
    try {
      const res = await fetch(`/api/live-events/${eventId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, alertId, requestKey: `${action}-${alertId}-${Date.now()}` }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `Lỗi ${res.status}`);
      if (action === "create-incident") setPanelAlert(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Lỗi hành động");
    } finally {
      setBusyAlert(null);
    }
  }

  const openAlerts = useMemo(
    () => (data?.alerts ?? []).filter((a) => a.status === "OPEN" || a.status === "SNOOZED"),
    [data],
  );
  // KPI "đang mở" = OPEN + SNOOZED (không tính đã Ack) — nhất quán với danh sách bên phải
  const kpiAlertsOpen = openAlerts.length;

  if (loadState === "error" && !data) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="surface p-12 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="font-semibold mb-1">Mất kết nối tới stream</div>
          <p className="text-dim text-[13px] mb-4">Không tải được dữ liệu trực tiếp. Kiểm tra server rồi thử lại.</p>
          <button className="btn btn-primary" onClick={load}>Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1400px] mx-auto">
      {/* ===== sticky status header ===== */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 mb-4 backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`badge ${eventStatus === "LIVE" ? "badge-live" : "badge-p3"}`}>
              {eventStatus === "LIVE" && <span className="status-dot status-live" style={{ width: 6, height: 6 }} />}
              {eventStatus}
            </span>
            <h1 className="text-[16px] font-bold tracking-tight truncate">{eventName}</h1>
            <span className={modeBadge}>{dataMode}</span>
            {kpi && kpi.slaBreached > 0 && (
              <span className="badge badge-p0">{kpi.slaBreached} SLA quá hạn</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-faint">
            <span className="status-dot status-ok" />
            Polling 3s {paused && "· ⏸ tạm dừng"}
          </div>
        </div>
      </div>

      {/* ===== sim controls ===== */}
      <div className="surface p-3 mb-4 flex items-center gap-2 flex-wrap">
        {!sim?.running ? (
          <button className="btn btn-primary text-[12.5px]" disabled={simBusy} onClick={() => simAction("start")}>
            ▶ Start demo stream
          </button>
        ) : sim.paused ? (
          <button className="btn btn-primary text-[12.5px]" disabled={simBusy} onClick={() => simAction("resume")}>
            ⏵ Resume simulator
          </button>
        ) : (
          <button className="btn btn-ghost text-[12.5px]" disabled={simBusy} onClick={() => simAction("pause")}>
            ⏸ Pause simulator
          </button>
        )}
        {sim?.running && sim.paused && <span className="badge badge-p3">PAUSED</span>}
        {sim?.running && !sim.paused && <span className="badge badge-live">RUNNING · tick {sim.tick}</span>}
        {!sim?.running && <span className="badge badge-p3">STOPPED</span>}
        <div className="flex-1" />
        {eventStatus === "LIVE" && (
          <button className="btn btn-primary text-[12.5px]" onClick={() => setConnPanel((v) => !v)}>
            🔌 Nguồn comment thật
          </button>
        )}
        <button className="btn btn-ghost text-[12.5px]" onClick={() => setPaused((p) => !p)}>
          {paused ? "⏵ Resume feed" : "⏸ Pause feed"}
        </button>
      </div>

      {/* ===== Connector nguồn comment thật (LIVE mode) ===== */}
      {connPanel && (
        <div className="surface p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span className="text-[13.5px] font-bold">🔌 Nguồn comment thật</span>
            {data?.connector && data.connector.status !== "DISCONNECTED" && (
              <>
                <span className={`badge ${data.connector.status === "CONNECTED" ? "badge-live" : data.connector.status === "ERROR" ? "badge-p0" : "badge-demo"}`}>
                  {data.connector.status}{data.connector.platform ? ` · ${data.connector.platform}` : ""}
                </span>
                <span className="text-dim text-[12px]">{data.connector.source} · {data.connector.ingested} comment đã bơm</span>
                <button className="btn btn-ghost text-[12px]" disabled={connBusy} onClick={() => connectorAction("disconnect")}>
                  Ngắt kết nối
                </button>
              </>
            )}
          </div>
          {(!data?.connector || data.connector.status === "DISCONNECTED" || data.connector.status === "ERROR") && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button className={`btn text-[12.5px] ${connPlatform === "tiktok" ? "btn-primary" : "btn-ghost"}`} onClick={() => setConnPlatform("tiktok")}>TikTok Live</button>
                <button className={`btn text-[12.5px] ${connPlatform === "facebook" ? "btn-primary" : "btn-ghost"}`} onClick={() => setConnPlatform("facebook")}>Facebook Live</button>
              </div>
              {connPlatform === "tiktok" ? (
                <label className="field">
                  <span className="label">Username TikTok (hoặc link live)</span>
                  <input className="input" value={connUsername} onChange={(e) => setConnUsername(e.target.value)} placeholder="@tenkeng hoặc https://www.tiktok.com/@tenkeng/live" />
                  <p className="text-faint text-[11.5px] mt-1">Bỏ trống sẽ dùng link đã dán ở Linkstream (tiktok.com/@username/live). Kênh phải đang LIVE.</p>
                </label>
              ) : (
                <>
                  <label className="field">
                    <span className="label">Video ID / link live Facebook</span>
                    <input className="input" value={connVideoId} onChange={(e) => setConnVideoId(e.target.value)} placeholder="https://facebook.com/watch/?v=123456789 hoặc bỏ trống dùng Linkstream" />
                  </label>
                  <label className="field">
                    <span className="label">Page Access Token (không lưu — chỉ dùng phiên này)</span>
                    <input className="input" type="password" value={connToken} onChange={(e) => setConnToken(e.target.value)} placeholder="EAAG..." />
                  </label>
                </>
              )}
              <button className="btn btn-primary text-[12.5px]" disabled={connBusy || (connPlatform === "facebook" && !connToken)} onClick={() => connectorAction("connect")}>
                {connBusy ? "Đang kết nối..." : "Kết nối"}
              </button>
            </div>
          )}
          {data?.connector?.error && <div className="callout callout-danger mt-3">{data.connector.error}</div>}
          {connError && <div className="callout callout-danger mt-3">{connError}</div>}
        </div>
      )}

      {actionError && <div className="callout callout-danger mb-4">{actionError}</div>}

      {/* ===== Cấp độ khủng hoảng + kịch bản real-time (4 mức độ) ===== */}
      <CrisisEscalationBanner
        eventStatus={eventStatus}
        alerts={data?.alerts ?? []}
        openIncidents={kpi?.openIncidents ?? 0}
        openP0Incidents={kpi?.openP0Incidents ?? 0}
        riskMessages5m={
          (data?.messages ?? []).filter(
            (m) => m.riskType && m.riskType !== "none" && Date.now() - new Date(m.createdAt).getTime() < 5 * 60_000,
          ).length
        }
      />

      <div className="grid lg:grid-cols-[280px_1fr_340px] gap-4">
        {/* ===== cột trái: KPI ===== */}
        <div className="space-y-3 order-2 lg:order-1">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="surface kpi-tile p-3.5">
              <div className="text-faint text-[10.5px] font-semibold mb-1.5">MESSAGES · 5 PHÚT</div>
              <div className="text-2xl font-bold tabular">{kpi?.messagesLast5m ?? "—"}</div>
              {kpi && (
                <div className={`text-[11px] mt-1 ${kpi.messagesLast5m >= kpi.messagesPrev5m ? "text-ok" : "text-dim"}`}>
                  {kpi.messagesLast5m >= kpi.messagesPrev5m ? "▲" : "▼"} so với 5 phút trước ({kpi.messagesPrev5m})
                </div>
              )}
            </div>
            <div className="surface kpi-tile p-3.5">
              <div className="text-faint text-[10.5px] font-semibold mb-1.5">VELOCITY / PHÚT</div>
              <div className="text-2xl font-bold tabular">{kpi?.velocity ?? "—"}</div>
              {kpi?.topTopic && (
                <div className="text-[11px] mt-1 text-dim">
                  {TOPIC_EMOJI[kpi.topTopic] ?? "💬"} {kpi.topTopic}
                </div>
              )}
            </div>
            <div className="surface kpi-tile p-3.5">
              <div className="text-faint text-[10.5px] font-semibold mb-1.5">ALERTS ĐANG MỞ</div>
              <div className="text-2xl font-bold tabular">{data ? kpiAlertsOpen : "—"}</div>
              {kpi && (
                <div className="flex gap-1 mt-1.5">
                  {(["P0", "P1", "P2", "P3"] as const).map(
                    (p) =>
                      kpi.alertsByPriority[p] > 0 && (
                        <span key={p} className={PRIORITY_BADGE[p]}>{p}·{kpi.alertsByPriority[p]}</span>
                      ),
                  )}
                </div>
              )}
            </div>
            <div className="surface kpi-tile p-3.5">
              <div className="text-faint text-[10.5px] font-semibold mb-1.5">INCIDENTS ĐANG MỞ</div>
              <div className="text-2xl font-bold tabular">{kpi?.openIncidents ?? "—"}</div>
              {kpi && kpi.openIncidents > 0 && (
                <a className="text-[11px] mt-1 link" href={`/workspaces/${workspaceId}/incidents`}>Xem danh sách →</a>
              )}
            </div>
          </div>
        </div>

        {/* ===== giữa: message feed ===== */}
        <div className="order-1 lg:order-2 min-w-0">
          <div className="surface p-3 mb-3 flex items-center gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-[160px] text-[12.5px]"
              placeholder="Tìm trong feed…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className={`btn text-[12px] ${riskOnly ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setRiskOnly((v) => !v)}
            >
              ⚠ Chỉ rủi ro
            </button>
            {platformFilter && (
              <button className="btn btn-ghost text-[12px]" onClick={() => setPlatformFilter(null)}>
                ✕ {PLATFORM_META[platformFilter]?.label ?? platformFilter}
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredMsgs.length === 0 ? (
              <div className="surface p-10 text-center">
                <div className="text-3xl mb-2">💬</div>
                <div className="font-semibold text-[14px] mb-1">
                  {data ? "Chưa có message khớp bộ lọc" : "Đang tải feed…"}
                </div>
                <p className="text-dim text-[12.5px]">
                  {data ? "Thử xoá bộ lọc hoặc start demo stream để nhận message." : "Vài giây nữa feed sẽ xuất hiện."}
                </p>
              </div>
            ) : (
              filteredMsgs.map((m) => (
                <div key={m.id} className={`surface card-hover p-3 ${m.riskType ? "risk-edge" : ""}`}>
                  <div className="flex items-center gap-2 text-[11.5px] text-faint mb-1">
                    <span className={`platform-dot ${PLATFORM_META[m.platform]?.cls ?? "pf-other"}`} />
                    <span className="font-semibold text-dim">{m.maskedName}</span>
                    <span>· {timeAgo(m.createdAt)}</span>
                    {m.topic && (
                      <span className="badge badge-p3 text-[10px]">
                        {TOPIC_EMOJI[m.topic] ?? "💬"} {m.topic}
                      </span>
                    )}
                    {m.riskType && <span className="badge badge-p2 text-[10px]">⚠ {m.riskType}</span>}
                    {m.likes > 0 && <span className="ml-auto">♥ {m.likes}</span>}
                  </div>
                  <div className="text-[13px] leading-snug">{m.text}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ===== phải: alerts + SLA ===== */}
        <div className="order-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold">ALERTS ({openAlerts.length} mở)</h2>
            {data && data.kpi.slaBreached > 0 && (
              <span className="text-[11px] text-danger font-semibold">{data.kpi.slaBreached} quá SLA</span>
            )}
          </div>

          {openAlerts.length === 0 ? (
            <div className="surface p-8 text-center">
              <div className="text-2xl mb-2">🔔</div>
              <div className="font-semibold text-[13px] mb-1">Không có alert nào mở</div>
              <p className="text-dim text-[12px]">
                {sim?.running ? "Hệ thống đang theo dõi — alert sẽ xuất hiện khi phát hiện rủi ro." : "Start demo stream để sinh alert mẫu."}
              </p>
            </div>
          ) : (
            openAlerts.map((a) => {
              const mins = slaMinutes(a.priority);
              const elapsed = now - new Date(a.createdAt).getTime();
              const remainMs = mins * 60_000 - elapsed;
              const overdue = remainMs < 0;
              const pct = Math.min(100, Math.max(0, (elapsed / (mins * 60_000)) * 100));
              const mm = Math.floor(Math.abs(remainMs) / 60_000);
              const ss = Math.floor((Math.abs(remainMs) % 60_000) / 1000);
              return (
                <div key={a.id} className={`surface card-hover p-3.5 ${overdue ? "sla-breach" : ""}`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={PRIORITY_BADGE[a.priority] ?? "badge"}>{a.priority}</span>
                    <span className="text-[13px] font-semibold flex-1 min-w-0 truncate">{a.title}</span>
                    <span className="text-[11px] text-faint">{timeAgo(a.createdAt)}</span>
                  </div>
                  <div className="text-[12px] text-dim mb-2 line-clamp-2">{a.reason}</div>
                  <div className="flex items-center gap-2 text-[11px] text-faint mb-2">
                    <span>📊 {a.evidenceCount} evidence</span>
                    <span>⚡ {a.velocity}/m</span>
                  </div>
                  {/* SLA progress */}
                  <div className="sla-track mb-2.5">
                    <div
                      className="sla-fill"
                      style={{
                        width: `${pct}%`,
                        background: overdue ? "var(--danger)" : pct > 70 ? "var(--warning)" : "var(--ok)",
                      }}
                    />
                  </div>
                  <div className={`text-[11px] mb-2 font-semibold ${overdue ? "text-danger" : "text-dim"}`}>
                    {a.status === "OPEN"
                      ? overdue
                        ? `⏰ Quá SLA ${mm}m ${ss}s`
                        : `SLA còn ${mm}m ${ss}s`
                      : `✓ ${a.status.toLowerCase()}`}
                  </div>
                  {panelAlert === a.id ? (
                    <div className="flex gap-1.5 flex-wrap">
                      <button className="btn btn-primary text-[11.5px]" disabled={busyAlert === a.id} onClick={() => alertAction(a.id, "create-incident")}>
                        🚨 Tạo incident
                      </button>
                      <button className="btn btn-ghost text-[11.5px]" disabled={busyAlert === a.id} onClick={() => alertAction(a.id, "acknowledge")}>
                        Ack
                      </button>
                      <button className="btn btn-ghost text-[11.5px]" disabled={busyAlert === a.id} onClick={() => alertAction(a.id, "snooze")}>
                        Snooze 10m
                      </button>
                      <button className="btn btn-danger-ghost text-[11.5px]" disabled={busyAlert === a.id} onClick={() => alertAction(a.id, "dismiss")}>
                        Dismiss
                      </button>
                      <button className="btn btn-ghost text-[11.5px]" onClick={() => setPanelAlert(null)}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost text-[11.5px] w-full" onClick={() => setPanelAlert(a.id)}>
                      Xử lý ▾
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
