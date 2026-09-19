"use client";

import { SearchIcon } from "@/components/icons";

/** Ô tìm kiếm topbar — client (cần onKeyDown điều hướng). */
export default function TopbarSearch({ workspaceId }: { workspaceId: string }) {
  return (
    <label className="topbar-search">
      <SearchIcon size={16} className="topbar-search-ico" />
      <input
        type="search"
        placeholder="Tìm kiếm sự kiện, chiến dịch..."
        aria-label="Tìm kiếm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const q = (e.target as HTMLInputElement).value.trim();
            if (q)
              window.location.href = `/workspaces/${workspaceId}/live-events?q=${encodeURIComponent(q)}`;
          }
        }}
      />
    </label>
  );
}
