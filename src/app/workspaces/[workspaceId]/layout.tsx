import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import SidebarNav, { type NavItem } from "./SidebarNav";
import TopbarSearch from "./TopbarSearch";
import { BellIcon } from "@/components/icons";

const CAN_VIEW_AUDIT = ["OWNER", "CRISIS_LEAD", "BRAND_MANAGER", "LEGAL_REVIEWER", "ANALYST"];

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
    include: { workspace: true, user: true },
  });
  // Tenant isolation ở layout: không thuộc workspace → về login
  if (!membership) redirect("/login");
  const ws = membership.workspace;

  // Số incident chưa xử lý xong — badge đỏ trên nav Incidents
  const openIncidents = await prisma.incident.count({
    where: { workspaceId, status: { notIn: ["RESOLVED", "CLOSED"] } },
  });

  const nav: NavItem[] = [
    { href: "", label: "Tổng quan", icon: "home" },
    { href: "live-events", label: "Live Events", icon: "broadcast", badge: true },
    { href: "incidents", label: "Incidents", icon: "alert", count: openIncidents },
    { href: "response-templates", label: "Response Studio", icon: "file" },
  ];
  if (CAN_VIEW_AUDIT.includes(membership.role)) {
    nav.push({ href: "audit-logs", label: "Audit Logs", icon: "shield" });
  }

  const initials = (session.user.name ?? session.user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen flex">
      <aside className="sb hidden md:flex flex-col sticky top-0 h-screen">
        {/* Brand: logo LiveGuard + tagline */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="LiveGuard" className="w-11 h-11" />
            <div className="min-w-0">
              <div className="sb-brand">
                Live<span>Guard</span>
              </div>
              <div className="sb-tagline">Monitor · Prevent · Respond</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <SidebarNav items={nav} basePath={`/workspaces/${workspaceId}`} />

        {/* User card + logout */}
        <div className="px-4 pb-3">
          <div className="sb-user">
            <span className="sb-avatar">{initials}</span>
            <span className="min-w-0 flex-1">
              <span className="sb-user-name">{session.user.name ?? session.user.email}</span>
              <span className="sb-user-role">{membership.role}</span>
            </span>
            <svg className="sb-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <form
            action={async () => {
              "use server";
              const { cookies } = await import("next/headers");
              const { destroySession, SESSION_COOKIE } = await import("@/lib/auth");
              const store = await cookies();
              const t = store.get(SESSION_COOKIE)?.value;
              if (t) await destroySession(t);
              redirect("/login");
            }}
          >
            <button className="sb-logout">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Đăng xuất
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar: chuông thông báo + tìm kiếm */}
        <header className="topbar">
          <button className="topbar-bell" title="Thông báo" aria-label="Thông báo">
            <BellIcon size={19} />
            {openIncidents > 0 && <span className="topbar-bell-dot" aria-hidden />}
          </button>
          <TopbarSearch workspaceId={workspaceId} />
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
