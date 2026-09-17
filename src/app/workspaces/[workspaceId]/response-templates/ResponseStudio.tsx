"use client";

import { useState } from "react";

type Tpl = {
  id: string;
  name: string;
  situation: string;
  channel: string;
  tone: string;
  body: string;
  bannedClaims: string[];
  version: number;
  status: string;
};
type Draft = { id: string; title: string; templateName: string; incidentTitle: string; status: string; createdAt: string };

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "badge badge-live",
  INACTIVE: "badge badge-p3",
  DRAFT: "badge badge-demo",
  PENDING_APPROVAL: "badge badge-p2",
  APPROVED: "badge badge-live",
  REJECTED: "badge badge-disconnected",
  USED: "badge badge-demo",
  ARCHIVED: "badge badge-p3",
};

export default function ResponseStudio({ role, templates, drafts }: { role: string; templates: Tpl[]; drafts: Draft[] }) {
  const [selected, setSelected] = useState<string | null>(templates[0]?.id ?? null);
  const t = templates.find((x) => x.id === selected) ?? null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Response Studio</h1>
        <p className="text-dim text-[13px] mt-0.5">Thư viện template theo playbook — mọi draft response phải đi qua approval trước khi dùng.</p>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <div className="surface p-2 self-start">
          {templates.length === 0 ? (
            <p className="text-dim text-xs p-3">Chưa có template nào.</p>
          ) : (
            <ul>
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    className={`w-full text-left px-3 py-2.5 rounded-[10px] text-[13px] transition-colors ${selected === tpl.id ? "bg-[var(--surface-2)] font-semibold border-l-2 border-[var(--accent)]" : "hover:bg-[var(--surface-2)]"}`}
                    onClick={() => setSelected(tpl.id)}
                  >
                    {tpl.name}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`badge ${tpl.status === "ACTIVE" ? "badge-live" : "badge-p3"}`}>{tpl.status}</span>
                      <span className="badge badge-p3">{tpl.channel}</span>
                      <span className="text-[10px] text-faint tabular">v{tpl.version}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {t ? (
            <div className="surface card-hover p-5 mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <b>{t.name}</b>
                <span className={STATUS_BADGE[t.status] ?? "badge"}>{t.status}</span>
              </div>
              <div className="text-[12px] text-dim mb-3">
                Tình huống: {t.situation} · Kênh: {t.channel} · Tông: {t.tone} · v{t.version}
              </div>
              <div className="text-[13px] whitespace-pre-wrap surface-2 rounded-[10px] p-3.5 leading-relaxed">{t.body}</div>
              {t.bannedClaims.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-[var(--danger)] mb-1">🚫 CLAIM BỊ CẤM</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {t.bannedClaims.map((c) => (
                      <span key={c} className="badge badge-disconnected">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="surface p-12 text-center grid-lines mb-4">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-dim text-[13px]">Chưa có template nào — templates được seed theo playbook, quản lý bởi Crisis Lead.</p>
            </div>
          )}

          <div className="surface p-4">
            <div className="text-[11px] text-faint font-semibold mb-2.5">DRAFT RESPONSE GẦN NHẤT ({drafts.length})</div>
            {drafts.length === 0 ? (
              <p className="text-dim text-xs">Chưa có draft nào — drafts được tạo trong trang incident.</p>
            ) : (
              <ul className="space-y-2">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-[13px] border-b border-[var(--border)] pb-2 last:border-0">
                    <div className="min-w-0">
                      <b className="truncate block">{d.title}</b>
                      <span className="text-dim text-[11px]">{d.incidentTitle} · {d.templateName} · {new Date(d.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                    <span className={STATUS_BADGE[d.status] ?? "badge shrink-0"}>{d.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-dim mt-3">
              🔒 Vai trò {role}: {["OWNER", "CRISIS_LEAD", "LEGAL_REVIEWER", "BRAND_MANAGER"].includes(role) ? "có quyền duyệt draft." : "chỉ xem — duyệt cần Owner/Crisis Lead/Legal/Brand Manager."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
