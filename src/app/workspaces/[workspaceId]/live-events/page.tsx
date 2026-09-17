import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge badge-p3",
  READY: "badge badge-demo",
  LIVE: "badge badge-live",
  ENDED: "badge badge-p3",
  CANCELLED: "badge badge-disconnected",
};

const PLATFORM_CLASS: Record<string, string> = {
  facebook: "pf-facebook",
  tiktok: "pf-tiktok",
  shopee: "pf-shopee",
  youtube: "pf-youtube",
};

export default async function LiveEventsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const events = await prisma.liveEvent.findMany({
    where: { workspaceId },
    include: { brand: { select: { name: true } }, campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const liveCount = events.filter((e) => e.status === "LIVE").length;
  const draftCount = events.filter((e) => e.status === "DRAFT" || e.status === "READY").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Live Events</h1>
          <p className="text-dim text-[13px] mt-0.5">
            {liveCount > 0 ? `${liveCount} sự kiện đang LIVE · ` : ""}
            {draftCount > 0 ? `${draftCount} chuẩn bị · ` : ""}
            {events.length} tổng cộng
          </p>
        </div>
        <Link className="btn btn-primary" href={`/workspaces/${workspaceId}/live-events/new`}>
          + Tạo event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="surface p-12 text-center grid-lines">
          <div className="text-4xl mb-3">📺</div>
          <div className="font-semibold mb-1">Chưa có live event nào</div>
          <p className="text-dim text-[13px] mb-5 max-w-sm mx-auto">
            Tạo event đầu tiên để bắt đầu theo dõi tín hiệu khủng hoảng theo thời gian thực.
          </p>
          <Link className="btn btn-primary" href={`/workspaces/${workspaceId}/live-events/new`}>
            Tạo event đầu tiên
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {events.map((e) => {
            const platforms = JSON.parse(e.platforms) as string[];
            return (
              <Link
                key={e.id}
                href={`/workspaces/${workspaceId}/live-events/${e.id}`}
                className="surface card-hover block p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] truncate mb-1.5">{e.name}</div>
                    <div className="flex items-center gap-2.5 flex-wrap text-[12px] text-dim">
                      <span>{e.brand.name}</span>
                      {e.campaign && <><span className="text-faint">·</span><span>{e.campaign.name}</span></>}
                      <span className="text-faint">·</span>
                      <span className="flex items-center gap-1">
                        {platforms.map((p) => (
                          <span key={p} className={`platform-dot ${PLATFORM_CLASS[p] ?? "pf-other"}`} title={p} />
                        ))}
                      </span>
                      {e.scheduledAt && (
                        <>
                          <span className="text-faint">·</span>
                          <span>{new Date(e.scheduledAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge badge-demo">{e.dataMode}</span>
                    {e.status === "LIVE" ? (
                      <span className="badge badge-live"><span className="status-dot status-live" style={{ width: 6, height: 6 }} /> LIVE</span>
                    ) : (
                      <span className={STATUS_BADGE[e.status] ?? "badge"}>{e.status}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
