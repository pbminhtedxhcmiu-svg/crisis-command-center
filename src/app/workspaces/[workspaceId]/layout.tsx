import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";

const NAV = [
  { href: "live-events", label: "Live Events", icon: "📡" },
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

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-[var(--border)] p-4 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="px-2 pt-1 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-[10px] grid place-items-center text-[15px]"
              style={{ background: "var(--gradient-brand)", color: "#06121f" }}
            >
              ⛑
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold truncate">{ws.name}</div>
              <div className="text-[10.5px] text-faint">Crisis Command Center</div>
            </div>
          </div>
          <span className="badge badge-demo">{membership.role}</span>
        </div>

        <nav className="space-y-1 flex-1">
          {nav.map((item) => (
            <Link key={item.href} href={`/workspaces/${workspaceId}/${item.href}`} className="sidebar-link">
              <span className="sidebar-icon" aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="surface-2 p-3 mb-3">
          <div className="text-[10.5px] text-faint font-semibold mb-0.5">ĐANG TRỰC</div>
          <div className="text-[12.5px] font-semibold truncate">{session.user.name ?? session.user.email}</div>
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
          <button className="btn btn-ghost w-full text-[12px]">→ Đăng xuất</button>
        </form>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
