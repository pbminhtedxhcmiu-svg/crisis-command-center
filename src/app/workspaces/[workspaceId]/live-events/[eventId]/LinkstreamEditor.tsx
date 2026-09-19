"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  shopee: "Shopee Live",
  youtube: "YouTube",
};

/**
 * Xem / thêm / sửa linkstream (URL phát theo nền tảng) ngay trên trang chi tiết event.
 * Lưu qua PATCH /api/live-events/[eventId] với streamUrls.
 */
export default function LinkstreamEditor({
  eventId,
  platforms,
  initialUrls,
}: {
  eventId: string;
  platforms: string[];
  initialUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(platform: string, url: string) {
    setUrls((prev) => ({ ...prev, [platform]: url }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Chuỗi rỗng = xoá link của nền tảng đó
      const payload = Object.fromEntries(
        Object.entries(urls).filter(([, u]) => u.trim() !== ""),
      );
      const res = await fetch(`/api/live-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamUrls: payload }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `Lỗi ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  }

  const filledCount = platforms.filter((p) => (urls[p] ?? "").trim() !== "").length;

  if (!editing) {
    return (
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-faint text-[10.5px] font-semibold">LINKSTREAM</div>
          <button type="button" className="btn btn-ghost text-[11px]" onClick={() => setEditing(true)}>
            ✏️ Sửa link
          </button>
        </div>
        {filledCount === 0 ? (
          <p className="text-dim text-[12.5px]">
            Chưa có linkstream nào. Bấm <b>Sửa link</b> để dán URL phát cho từng nền tảng.
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {platforms
              .filter((p) => (urls[p] ?? "").trim() !== "")
              .map((p) => (
                <a
                  key={p}
                  href={urls[p]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost text-[12px]"
                  title={urls[p]}
                >
                  <span className={`platform-dot pf-${p}`} style={{ width: 8, height: 8 }} />
                  Mở {PLATFORM_LABEL[p] ?? p} ↗
                </a>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-[10px] border border-[var(--border)]" style={{ background: "var(--surface-2)" }}>
      <div className="text-faint text-[10.5px] font-semibold mb-2">CHỈNH SỬA LINKSTREAM</div>
      <div className="space-y-2">
        {platforms.map((p) => (
          <div key={p} className="flex gap-2 items-center">
            <span className={`platform-dot pf-${p}`} style={{ width: 8, height: 8 }} />
            <span className="text-[12.5px] w-24 shrink-0 text-dim">{PLATFORM_LABEL[p] ?? p}</span>
            <input
              className="input flex-1"
              value={urls[p] ?? ""}
              onChange={(e) => set(p, e.target.value)}
              placeholder={`https://${p === "shopee" ? "live.shopee.vn/..." : p + ".com/..."} (bỏ trống để xoá)`}
            />
          </div>
        ))}
      </div>
      {error && <div className="callout callout-danger mt-2 text-[12px]">{error}</div>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          className="btn btn-ghost text-[12px]"
          onClick={() => {
            setUrls(initialUrls);
            setError(null);
            setEditing(false);
          }}
          disabled={busy}
        >
          Huỷ
        </button>
        <button type="button" className="btn btn-primary text-[12px]" onClick={save} disabled={busy}>
          {busy ? "Đang lưu..." : "Lưu linkstream"}
        </button>
      </div>
    </div>
  );
}
