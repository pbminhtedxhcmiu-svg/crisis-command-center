"use client";

import { useState } from "react";
import { can, type WorkspaceRole } from "@/lib/rbac";

type ChecklistItem = { id?: string; label: string; detail?: string | null };
type Playbook = {
  id: string;
  name: string;
  description: string | null;
  riskKeywords: string[];
  eventsUsing: number;
  checklist: ChecklistItem[];
};

// Playbook mặc định gợi ý khi workspace chưa có — bài học từ case "O sầu riêng 10/2024"
const PRESET_HOST_STATEMENT = {
  name: "Rủi ro phát ngôn host/KOL (vạ mồm)",
  description:
    "Phòng và xử lý khủng hoảng do phát ngôn xúc phạm khách/cam kết sai của host hoặc khách mời trong live.",
  checklist: [
    { label: "Brief phát ngôn trước live: danh sách điều KHÔNG được nói (không chê khách, không cam kết ngoài kịch bản)", detail: "Host + KOL ký nhận trước giờ G" },
    { label: "Kiểm tra kịch bản: mọi con số/cam kết sản phẩm phải có hồ sơ kiểm định kèm theo", detail: "Brand Manager xác nhận" },
    { label: "Chuẩn bị phản ứng nhanh cho 3 tình huống: khách chê hàng, host nói sai số liệu, KOL nói quá công dụng", detail: "Producer giữ sẵn câu thoại đính chính" },
    { label: "Phân công 1 moderator trực luồng theo dõi phát ngôn + comment trích dẫn lời nói của host/KOL", detail: "Không rời ghế trong suốt phiên live" },
    { label: "Quay toàn bộ phiên live (về làm bằng chứng phản bác/đính chính)", detail: "VOD lưu tối thiểu 90 ngày" },
    { label: "Chốt kênh xin lỗi/đính chính nếu sự cố xảy ra: template công bố + người duyệt", detail: "Legal duyệt trước khi đăng" },
  ] as { label: string; detail: string }[],
  riskKeywords: [
    "vạ mồm", "chê khách", "nói xấu khách", "xúc phạm khách", "nghèo mà đòi",
    "quảng cáo quá sự thật", "cam kết sai", "nói quá", "hứa suông",
    "host xúc phạm", "thái độ với khách", "quang linh",
  ],
};

export default function PlaybooksManager({
  workspaceId,
  role,
  playbooks,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  playbooks: Playbook[];
}) {
  const canManage = can(role, "playbook.manage");
  const [items, setItems] = useState<Playbook[]>(playbooks);
  const [editing, setEditing] = useState<Playbook | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPreset = items.some((p) => p.name === PRESET_HOST_STATEMENT.name);

  async function call(method: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playbooks", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? `Lỗi ${res.status}`);
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function createPreset() {
    try {
      await call("POST", { workspaceId, ...PRESET_HOST_STATEMENT });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    }
  }

  async function remove(pb: Playbook) {
    if (!confirm(`Xoá playbook "${pb.name}"?${pb.eventsUsing > 0 ? ` ${pb.eventsUsing} event đang gắn playbook này.` : ""}`)) return;
    try {
      await call("DELETE", { workspaceId, id: pb.id });
      setItems((prev) => prev.filter((p) => p.id !== pb.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-1">Playbooks</h1>
          <p className="text-dim text-[13px]">
            Checklist trước giờ live + từ khóa cảnh báo phát ngôn host/KOL được bơm vào pipeline phát hiện rủi ro.
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setEditing("new")} disabled={busy}>
            + Playbook mới
          </button>
        )}
      </div>

      {!canManage && (
        <div className="callout callout-info mb-4">Bạn chỉ xem — quyền quản lý playbook thuộc OWNER / CRISIS_LEAD / BRAND_MANAGER.</div>
      )}
      {error && <div className="callout callout-danger mb-4">{error}</div>}

      {canManage && !hasPreset && (
        <div className="surface card-hover p-4 mb-4 border border-[var(--accent)]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold text-[13.5px] mb-1">📌 Gợi ý: {PRESET_HOST_STATEMENT.name}</div>
              <div className="text-dim text-[12.5px]">{PRESET_HOST_STATEMENT.description}</div>
              <div className="text-faint text-[11.5px] mt-1">
                {PRESET_HOST_STATEMENT.checklist.length} mục checklist · {PRESET_HOST_STATEMENT.riskKeywords.length} từ khóa cảnh báo
              </div>
            </div>
            <button className="btn btn-primary text-[12.5px]" onClick={createPreset} disabled={busy}>
              Thêm playbook gợi ý
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && <div className="text-dim text-[13px]">Chưa có playbook nào trong workspace.</div>}
        {items.map((pb) => (
          <div key={pb.id} className="surface card-hover p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-[14px]">{pb.name}</div>
                {pb.description && <div className="text-dim text-[12.5px] mt-0.5">{pb.description}</div>}
                <div className="text-faint text-[11.5px] mt-1.5">
                  {pb.checklist.length} mục checklist · {pb.riskKeywords.length} từ khóa · {pb.eventsUsing} event đang dùng
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2 shrink-0">
                  <button className="btn btn-ghost text-[12.5px]" onClick={() => setEditing(pb)} disabled={busy}>
                    Sửa
                  </button>
                  <button className="btn btn-ghost text-[12.5px] text-danger" onClick={() => remove(pb)} disabled={busy}>
                    Xoá
                  </button>
                </div>
              )}
            </div>

            {pb.checklist.length > 0 && (
              <ul className="mt-3 pt-3 border-t border-[var(--border)] space-y-1.5">
                {pb.checklist.map((c, i) => (
                  <li key={c.id ?? i} className="text-[12.5px] flex gap-2">
                    <span className="text-faint shrink-0">{i + 1}.</span>
                    <span>
                      {c.label}
                      {c.detail && <span className="text-faint"> — {c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {pb.riskKeywords.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="text-faint text-[10.5px] font-semibold mb-2">TỪ KHÓA CẢNH BÁO (bơm vào classifier + alert)</div>
                <div className="flex flex-wrap gap-1.5">
                  {pb.riskKeywords.map((k) => (
                    <span key={k} className="badge badge-p2 text-[11px]">{k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <EditDialog
          workspaceId={workspaceId}
          playbook={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  workspaceId,
  playbook,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  playbook: Playbook | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(playbook?.name ?? "");
  const [description, setDescription] = useState(playbook?.description ?? "");
  const [checklist, setChecklist] = useState<{ label: string; detail: string }[]>(
    playbook?.checklist.map((c) => ({ label: c.label, detail: c.detail ?? "" })) ?? [{ label: "", detail: "" }],
  );
  const [keywords, setKeywords] = useState(playbook?.riskKeywords.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...(playbook ? { id: playbook.id } : {}),
          name: name.trim(),
          description: description.trim() || undefined,
          checklist: checklist.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), detail: c.detail.trim() || undefined })),
          riskKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? `Lỗi ${res.status}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(2,8,18,0.72)" }} onClick={onClose}>
      <div className="surface p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-bold mb-4">{playbook ? "Sửa playbook" : "Playbook mới"}</h2>

        <label className="field mb-3">
          <span className="label">Tên *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Rủi ro phát ngôn host/KOL (vạ mồm)" autoFocus />
        </label>
        <label className="field mb-4">
          <span className="label">Mô tả</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Phạm vi áp dụng, mục tiêu..." />
        </label>

        <div className="field mb-4">
          <span className="label">Checklist trước giờ live (mục đọc-ghim khi tạo event)</span>
          <div className="space-y-2">
            {checklist.map((c, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="text-faint text-[12px] w-5 text-right shrink-0">{idx + 1}.</span>
                <input
                  className="input flex-1"
                  value={c.label}
                  onChange={(e) => setChecklist((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                  placeholder="Việc phải hoàn tất trước live"
                />
                <input
                  className="input w-56"
                  value={c.detail}
                  onChange={(e) => setChecklist((prev) => prev.map((x, i) => (i === idx ? { ...x, detail: e.target.value } : x)))}
                  placeholder="Ghi chú / người phụ trách"
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setChecklist((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))}
                  disabled={checklist.length === 1}
                  aria-label="Xoá dòng"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost text-[12.5px]" onClick={() => setChecklist((prev) => [...prev, { label: "", detail: "" }])}>
              + Thêm mục
            </button>
          </div>
        </div>

        <label className="field mb-4">
          <span className="label">Từ khóa cảnh báo phát ngôn (phân tách bằng dấu phẩy — bơm vào classifier)</span>
          <textarea
            className="input"
            rows={3}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="vạ mồm, chê khách, quảng cáo quá sự thật, cam kết sai..."
          />
        </label>

        {error && <div className="callout callout-danger mb-4">{error}</div>}

        <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || name.trim().length < 3}>
            {busy ? "Đang lưu..." : "Lưu playbook"}
          </button>
        </div>
      </div>
    </div>
  );
}
