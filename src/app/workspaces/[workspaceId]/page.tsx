import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import { BroadcastIcon, AlertIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Trang Tổng quan — workspace root. Tóm tắt hiện trạng + truy cập nhanh. */
export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
    include: { workspace: true },
  });
  if (!membership) redirect("/login");

  const [liveCount, eventCount, openIncidents, msgToday] = await Promise.all([
    prisma.liveEvent.count({ where: { workspaceId, status: "LIVE" } }),
    prisma.liveEvent.count({ where: { workspaceId } }),
    prisma.incident.count({ where: { workspaceId, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.message.count({
      where: {
        event: { workspaceId },
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    }),
  ]);

  const recentEvents = await prisma.liveEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { brand: { select: { name: true } } },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="ov-title mb-1">
        Tổng <span>quan</span>
      </h1>
      <p className="text-dim text-[13px] mb-6">
        Xin chào {session.user.name ?? session.user.email} — đây là hiện trạng của{" "}
        {membership.workspace.name}.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="surface p-4">
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">ĐANG LIVE</div>
          <div className="text-2xl font-bold tabular text-ok">{liveCount}</div>
        </div>
        <div className="surface p-4">
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">SỰ KIỆN</div>
          <div className="text-2xl font-bold tabular">{eventCount}</div>
        </div>
        <div className="surface p-4">
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">INCIDENT MỞ</div>
          <div className="text-2xl font-bold tabular text-warn">{openIncidents}</div>
        </div>
        <div className="surface p-4">
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">MESSAGE / 24H</div>
          <div className="text-2xl font-bold tabular">{msgToday}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold">Sự kiện gần đây</h2>
            <Link className="text-[12px] text-dim hover:text-[var(--text)]" href={`/workspaces/${workspaceId}/live-events`}>
              Xem tất cả →
            </Link>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-dim text-[13px]">Chưa có sự kiện nào. Tạo event đầu tiên để bắt đầu.</p>
          ) : (
            <ul className="space-y-2">
              {recentEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    className="flex items-center gap-2.5 p-2.5 rounded-[10px] hover:bg-[var(--surface-2)] transition-colors"
                    href={`/workspaces/${workspaceId}/live-events/${e.id}`}
                  >
                    <BroadcastIcon size={15} className="text-dim shrink-0" />
                    <span className="text-[13px] font-medium truncate flex-1">{e.name}</span>
                    <span className="badge badge-demo text-[10px]">{e.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold">Cần chú ý</h2>
            {openIncidents > 0 && (
              <Link className="text-[12px] text-warn" href={`/workspaces/${workspaceId}/incidents`}>
                Xem incidents →
              </Link>
            )}
          </div>
          {openIncidents > 0 ? (
            <div className="callout callout-danger text-[12.5px] flex items-center gap-2">
              <AlertIcon size={15} />
              {openIncidents} incident chưa xử lý xong — kiểm tra ngay.
            </div>
          ) : (
            <p className="text-dim text-[13px]">Không có incident nào đang mở. Mọi thứ yên tĩnh. ✓</p>
          )}
        </div>
      </div>
    </div>
  );
}
