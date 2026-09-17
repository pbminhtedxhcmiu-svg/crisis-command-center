"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EVENT_TRANSITIONS_OK = true;

export default function EventDetailActions({
  eventId,
  workspaceId,
  status,
}: {
  eventId: string;
  workspaceId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: string) {
    setBusy(next);
    setError(null);
    try {
      const res = await fetch(`/api/live-events/${eventId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Lỗi ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(null);
    }
  }

  const actions: { label: string; next: string; kind: "primary" | "ghost" | "danger" }[] = [];
  if (status === "DRAFT") {
    actions.push({ label: "✓ Mark Ready", next: "ready", kind: "primary" });
    actions.push({ label: "Huỷ event", next: "cancel", kind: "danger" });
  } else if (status === "READY") {
    actions.push({ label: "▶ Bắt đầu Live", next: "start", kind: "primary" });
  } else if (status === "LIVE") {
    actions.push({ label: "■ Kết thúc", next: "end", kind: "danger" });
  }

  if (actions.length === 0 && status !== "ENDED" && status !== "CANCELLED") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a.next}
            className={`btn ${a.kind === "primary" ? "btn-primary" : a.kind === "danger" ? "btn-danger-ghost" : "btn-ghost"}`}
            disabled={busy !== null}
            onClick={() => transition(a.next)}
          >
            {busy === a.next ? "..." : a.label}
          </button>
        ))}
      </div>
      {error && <span className="text-danger text-[12px]">{error}</span>}
      {EVENT_TRANSITIONS_OK && status === "ENDED" && (
        <span className="text-faint text-[11.5px]">Event đã kết thúc — xem report để tổng kết.</span>
      )}
    </div>
  );
}
