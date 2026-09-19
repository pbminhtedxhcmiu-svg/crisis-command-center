"use client";

import { useState } from "react";

type Item = { id: string; label: string; detail?: string | null };

// Checklist trước giờ live áp từ playbook — tick từng mục, lưu LiveEvent.checklistState
export default function PreLiveChecklist({
  eventId,
  playbookName,
  items,
  initialState,
}: {
  eventId: string;
  playbookName: string;
  items: Item[];
  initialState: Record<string, boolean>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(initialState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const done = items.filter((i) => state[i.id]).length;

  async function toggle(itemId: string) {
    setBusyId(itemId);
    const optimistic = { ...state };
    if (optimistic[itemId]) delete optimistic[itemId];
    else optimistic[itemId] = true;
    setState(optimistic);
    try {
      const res = await fetch(`/api/live-events/${eventId}/checklist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setState(json.checklistState ?? optimistic);
    } catch {
      setState(state); // rollback
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="surface card-hover p-5 mb-4">
      <h2 className="text-[14px] font-bold mb-1 flex items-center justify-between">
        📋 Checklist trước live — {playbookName}
        <span className={done === items.length ? "text-ok text-[12px]" : "text-warn text-[12px]"}>
          {done}/{items.length}
        </span>
      </h2>
      <p className="text-faint text-[11.5px] mb-3">Đọc và tick từng mục trước khi chuyển event sang READY/LIVE.</p>
      <ul className="space-y-2">
        {items.map((item, idx) => {
          const checked = !!state[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                disabled={busyId === item.id}
                className="flex items-start gap-2.5 text-[13px] text-left w-full group"
              >
                <span
                  className="shrink-0 w-[18px] h-[18px] grid place-items-center rounded-[5px] text-[11px] mt-0.5 border transition-colors"
                  style={{
                    background: checked ? "var(--gradient-brand)" : "transparent",
                    borderColor: checked ? "transparent" : "var(--border)",
                    color: "#06121f",
                  }}
                >
                  {checked ? "✓" : ""}
                </span>
                <span className={checked ? "text-faint line-through" : ""}>
                  <span className="text-faint mr-1">{idx + 1}.</span>
                  {item.label}
                  {item.detail && <span className="text-faint"> — {item.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
