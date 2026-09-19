"use client";

import { useMemo, useState } from "react";
import {
  computeCrisisLevel,
  levelDef,
  levelReason,
  type CrisisLevel,
} from "@/lib/crisis/escalation";

type StreamAlertLite = { title: string; priority: string; status: string };

// Banner Cấp độ khủng hoảng + kịch bản xử lý real-time (framework 4 mức độ).
// Render thuần từ dữ liệu /stream — không gọi thêm API.
export default function CrisisEscalationBanner({
  eventStatus,
  alerts,
  openIncidents,
  openP0Incidents = 0,
  riskMessages5m,
}: {
  eventStatus: string;
  alerts: StreamAlertLite[];
  openIncidents: number;
  openP0Incidents?: number;
  riskMessages5m: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const input = useMemo(
    () => ({
      eventStatus,
      negativeMessagesLast5m: riskMessages5m,
      hasOpenP0Alert:
        openP0Incidents > 0 ||
        alerts.some((a) => a.priority === "P0" && a.status !== "CONVERTED" && a.status !== "DISMISSED"),
      hasOpenP1Alert: alerts.some((a) => a.priority === "P1" && a.status !== "CONVERTED" && a.status !== "DISMISSED"),
      openIncidents,
      hostStatementAlerts: alerts.filter(
        (a) => a.title.startsWith("[host_statement]") && a.status !== "CONVERTED" && a.status !== "DISMISSED",
      ).length,
      viewerDropPct: null,
    }),
    [eventStatus, alerts, openP0Incidents, openIncidents, riskMessages5m],
  );

  const level: CrisisLevel = computeCrisisLevel(input);
  const def = levelDef(level);
  const reason = levelReason(input);

  if (!def) return null; // level 0 — không banner

  return (
    <div className="surface p-4 mb-4" style={{ borderColor: "var(--accent)" }}>
      <button type="button" className="w-full text-left" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={def.color}>CẤP ĐỘ {def.level} · {def.code}</span>
          <span className="font-bold text-[14px]">{def.label}</span>
          <span className="text-dim text-[12px] hidden md:inline">— {reason}</span>
          <span className="flex-1" />
          <span className="text-faint text-[11.5px]">{expanded ? "Thu gọn ▲" : "Xem kịch bản xử lý ▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-faint text-[10.5px] font-semibold mb-2">TÍN HIỆU NHẬN DIỆN</div>
            <ul className="space-y-1 mb-4">
              {def.signals.map((s) => (
                <li key={s} className="text-[12.5px] text-dim flex gap-2">
                  <span className="text-faint">•</span>
                  {s}
                </li>
              ))}
            </ul>

            <div className="text-faint text-[10.5px] font-semibold mb-2">🚫 KHÔNG ĐƯỢC LÀM</div>
            <ul className="space-y-1">
              {def.dontDo.map((s) => (
                <li key={s} className="text-[12.5px] text-dim flex gap-2">
                  <span className="text-danger">✕</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-faint text-[10.5px] font-semibold mb-2">KỊCH BẢN XỬ LÝ REAL-TIME</div>
            <div className="space-y-2 mb-4">
              {def.actions.map((a, i) => (
                <div key={i} className="surface-2 p-2.5">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="badge badge-p3 text-[10px]">{a.role}</span>
                    <span className="text-faint text-[10.5px]">⏱ {a.deadline}</span>
                  </div>
                  <div className="text-[12.5px]">{a.action}</div>
                </div>
              ))}
            </div>

            <div className="callout callout-info">
              <div className="text-[10.5px] font-semibold mb-1">TEMPLATE HOST ĐỌC NGAY TRONG LIVE</div>
              <div className="text-[12.5px] italic">“{def.hostScript}”</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
