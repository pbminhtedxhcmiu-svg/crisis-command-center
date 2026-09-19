import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import SidebarNav, { type NavItem } from "./SidebarNav";

const NAV = [
  { href: "live-events", label: "Live Events", icon: "📡", badge: true },
  { href: "incidents", label: "Incidents", icon: "🚨" },
  { href: "response-templates", label: "Response Studio", icon: "📝" },
];

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

  const nav = CAN_VIEW_AUDIT.includes(membership.role)
    ? [...NAV, { href: "audit-logs", label: "Audit Logs", icon: "🛡" }]
    : NAV;

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
              <div className="sb-brand">Live<span>Guard</span></div>
              <div className="sb-tagline">Prevent&ensp;·&ensp;Monitor&ensp;·&ensp;Respond</div>
            </div>
          </div>
        </div>

        {/* Workspace switcher */}
        <div className="mx-3 mb-4">
          <Link
            href={`/workspaces/${workspaceId}/live-events`}
            className="sb-ws"
            title="Workspace hiện tại"
          >
            <span className="sb-ws-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-[26px] h-[26px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="sb-ws-name">{ws.name}</span>
              <span className="sb-ws-sub">Crisis Command Center</span>
            </span>
            <svg className="sb-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Nav */}
        <SidebarNav items={nav as NavItem[]} basePath={`/workspaces/${workspaceId}`} />

        {/* User card + logout */}
        <div className="px-3 pb-2">
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
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
