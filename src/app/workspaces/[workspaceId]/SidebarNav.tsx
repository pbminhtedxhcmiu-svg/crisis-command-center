"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BroadcastIcon,
  AlertIcon,
  FileTextIcon,
  ShieldCheckIcon,
  BookIcon,
} from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "broadcast" | "alert" | "file" | "book" | "shield";
  badge?: boolean;         // dot đỏ (Live Events)
  count?: number;          // badge số đếm (Incidents mở)
};

const ICONS = {
  home: HomeIcon,
  broadcast: BroadcastIcon,
  alert: AlertIcon,
  file: FileTextIcon,
  book: BookIcon,
  shield: ShieldCheckIcon,
};

/**
 * Nav sidebar icon SVG + trạng thái active theo route hiện tại.
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
    <nav className="sb-nav px-4 space-y-1 flex-1">
      {items.map((item) => {
        const href = `${basePath}/${item.href}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={href}
            className={`sidebar-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="sb-ico" aria-hidden>
              <Icon size={18} />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge && <span className="sb-dot" aria-hidden />}
            {typeof item.count === "number" && item.count > 0 && (
              <span className="sb-count">{item.count > 99 ? "99+" : item.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
