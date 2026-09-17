"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CAN_MANAGE = ["OWNER", "CRISIS_LEAD", "BRAND_MANAGER", "MODERATOR", "CUSTOMER_SERVICE"];
const CAN_APPROVE = ["OWNER", "CRISIS_LEAD", "LEGAL_REVIEWER", "BRAND_MANAGER"];

export default function IncidentActions({
  incidentId,
  workspaceId,
  status,
  severity,
  ownerId,
  role,
  currentUserId,
  members,
  templates,
  drafts,
}: {
  incidentId: string;
  workspaceId: string;
  status: string;
  severity: string;
  ownerId: string | null;
  role: string;
  currentUserId: string;
  members: { id: string; label: string; role: string }[];
  templates: { id: string; name: string; kind: string }[];
  drafts: {
    id: string;
    title: string;
    body: string;
    status: string;
    templateName: string | null;
    authorName: string;
    hasPendingApproval: boolean;
    rejectReason: string | null;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [vars, setVars] = useState("{}");

  const canManage = CAN_MANAGE.includes(role);
  const canApprove = CAN_APPROVE.includes(role);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Hành động thất bại");
        return;
      }
      setOkMsg("✅ Đã thực hiện");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ — thử lại");
    } finally {
      setBusy(false);
    }
  }

  async function draftAction(draftId: string, action: "request-approval") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/response-templates/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, workspaceId, draftId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Gửi duyệt thất bại");
        return;
      }
      setOkMsg("✅ Đã gửi duyệt — chờ approver quyết");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    if (!templateId) {
      setError("Chọn template trước");
      return;
    }
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(vars || "{}");
    } catch {
      setError("Biến phải là JSON hợp lệ, ví dụ {\"customer_name\":\"An\"}");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/response-templates/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          workspaceId,
          incidentId,
          templateId,
          title: `Draft từ template — incident ${incidentId.slice(-6)}`,
          vars: parsed,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Tạo draft thất bại");
        return;
      }
      setOkMsg("✅ Đã tạo draft — bấm 'Gửi duyệt' trên draft");
      setTemplateId("");
      setVars("{}");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  async function decide(draftId: string, decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/approve-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, decision, note: decision === "REJECTED" ? "Không phù hợp" : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Quyết định thất bại");
        return;
      }
      setOkMsg(`✅ Draft đã ${decision === "APPROVED" ? "được duyệt" : "bị từ chối"}`);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  const severities = ["P0", "P1", "P2", "P3"].filter((s) => s !== severity);
  const statuses = ["OPEN", "INVESTIGATING", "RESPONSE_PENDING", "RESPONDING", "MONITORING", "RESOLVED", "REOPENED"].filter((s) => s !== status);

  return (
    <div className="surface p-4">
      <div className="text-xs text-dim font-semibold mb-3">HÀNH ĐỘNG</div>
      {!canManage && <p className="text-[11px] text-dim mb-2">🔒 Vai trò {role} chỉ xem — không thao tác được.</p>}
      {error && <div role="alert" className="badge badge-disconnected mb-2 block">{error}</div>}
      {okMsg && <div role="status" className="badge badge-demo mb-2 block">{okMsg}</div>}

      <div className="flex gap-1.5 flex-wrap mb-3">
        {canManage && ownerId == null && (
          <button className="btn btn-primary text-[11px]" disabled={busy} onClick={() => act("assign", { userId: currentUserId, role: "owner" })}>
            👤 Assign cho tôi
          </button>
        )}
        {canManage && status === "OPEN" && (
          <button className="btn text-[11px]" disabled={busy} onClick={() => act("status", { to: "INVESTIGATING" })}>🔍 Investigate</button>
        )}
        {canManage && ["INVESTIGATING", "RESPONSE_PENDING"].includes(status) && (
          <button className="btn text-[11px]" disabled={busy} onClick={() => act("status", { to: "RESPONDING" })}>📝 Start response</button>
        )}
        {canManage && !["RESOLVED", "CLOSED"].includes(status) && (
          <button className="btn text-[11px]" disabled={busy} onClick={() => act("ack")}>👁 Acknowledge SLA</button>
        )}
        {severity !== "P0" && canManage && (
          <button className="btn btn-danger text-[11px]" disabled={busy} onClick={() => act("escalate")}>🚨 Escalate (nâng 1 mức)</button>
        )}
        {canManage && ["RESPONDING", "MONITORING", "RESPONSE_PENDING"].includes(status) && (
          <button className="btn text-[11px]" disabled={busy} onClick={() => act("resolve")}>✅ Resolve</button>
        )}
        {["RESOLVED", "CLOSED"].includes(status) && canManage && (
          <button className="btn text-[11px]" disabled={busy} onClick={() => act("reopen", { reason: "Mở lại theo yêu cầu" })}>↩ Reopen</button>
        )}
        {canManage && ["OPEN", "RESOLVED", "REOPENED"].includes(status) && (
          <button className="btn text-[11px]" disabled={busy} onClick={() => act("status", { to: "CLOSED", resolution: "Chốt incident" })}>🗂 Close</button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-[12px]">
        <div>
          <label className="text-[11px] text-dim block mb-1">Đổi severity</label>
          <div className="flex gap-1.5 flex-wrap">
            {severities.map((s) => (
              <button key={s} className="btn text-[10px]" disabled={busy || !canManage} onClick={() => act("severity", { severity: s })}>
                → {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-dim block mb-1">Chuyển assignee khác (support)</label>
          <div className="flex gap-1.5 flex-wrap">
            {members.slice(0, 6).map((m) => (
              <button key={m.id} className="btn text-[10px]" disabled={busy || !canManage} onClick={() => act("assign", { userId: m.id, role: "support" })}>
                + {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {canManage && (
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ghi chú nội bộ…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="btn text-[11px]"
            disabled={busy || !note.trim()}
            onClick={async () => {
              await act("note", { body: note.trim() });
              setNote("");
            }}
          >
            Thêm note
          </button>
        </div>
      )}

      {canManage && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <label className="text-[11px] text-dim block mb-1">Tạo response draft từ template</label>
          <div className="flex gap-1.5 flex-wrap items-center">
            <select className="input w-auto text-[12px]" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— chọn template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>
              ))}
            </select>
            <input
              className="input w-56"
              placeholder='Biến JSON: {"customer_name":"An"}'
              value={vars}
              onChange={(e) => setVars(e.target.value)}
            />
            <button className="btn btn-primary text-[11px]" disabled={busy || !templateId} onClick={createDraft}>
              Tạo draft
            </button>
          </div>
          {templates.length === 0 && (
            <p className="text-[11px] text-dim mt-1">Chưa có template active — cần template để tạo draft.</p>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        <div className="text-[11px] text-dim font-semibold mb-2">RESPONSE DRAFTS ({drafts.length})</div>
        {drafts.length === 0 ? (
          <p className="text-dim text-xs">Chưa có draft nào.</p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="border border-[var(--border)] rounded-[var(--radius)] p-2.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <b className="text-[13px]">{d.title}</b>
                  <span className={`badge ${d.status === "APPROVED" ? "badge-live" : d.status === "REJECTED" ? "badge-disconnected" : "badge-demo"}`}>
                    {d.status}
                  </span>
                  {d.templateName && <span className="badge badge-p3">{d.templateName}</span>}
                  <span className="text-[10px] text-dim">bởi {d.authorName}</span>
                </div>
                <div className="text-[13px] whitespace-pre-wrap">{d.body}</div>
                {d.rejectReason && <p className="text-[11px] text-[var(--danger)] mt-1">Lý do từ chối: {d.rejectReason}</p>}
                <div className="flex gap-1.5 mt-2">
                  {canManage && d.status === "DRAFT" && (
                    <button className="btn text-[10px]" disabled={busy} onClick={() => draftAction(d.id, "request-approval")}>
                      Gửi duyệt
                    </button>
                  )}
                  {d.status === "PENDING_APPROVAL" && canApprove && (
                    <>
                      <button className="btn text-[10px]" disabled={busy} onClick={() => decide(d.id, "APPROVED")}>✅ Approve</button>
                      <button className="btn btn-danger text-[10px]" disabled={busy} onClick={() => decide(d.id, "REJECTED")}>✕ Reject</button>
                    </>
                  )}
                  {d.status === "PENDING_APPROVAL" && !canApprove && (
                    <span className="text-[10px] text-dim">⏳ Chờ duyệt (Owner/Crisis Lead/Legal/Brand Manager)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
