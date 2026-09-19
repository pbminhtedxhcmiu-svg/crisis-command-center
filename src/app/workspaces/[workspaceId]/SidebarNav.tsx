"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: boolean;
};

/**
 * Nav sidebar có trạng thái active theo route hiện tại.
 * (Layout là server component — phải tách ra client để dùng usePathname.)
 */
export default function SidebarNav({
  items,
  basePath,
}: {
  items: NavItem[];
  basePath: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="px-3 space-y-1.5 flex-1">
      {items.map((item) => {
        const href = `${basePath}/${item.href}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={item.href}
            href={href}
            className={`sidebar-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="sidebar-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge && <span className="sb-dot" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}
