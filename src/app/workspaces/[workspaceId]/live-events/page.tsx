import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import { ClockIcon, KebabIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PLATFORM_CLASS: Record<string, string> = {
  facebook: "pf-facebook",
  tiktok: "pf-tiktok",
  shopee: "pf-shopee",
  youtube: "pf-youtube",
};

const STATUS_PILL: Record<string, { cls: string; label: string }> = {
  LIVE: { cls: "ev-pill-live", label: "Đang diễn ra" },
  DRAFT: { cls: "ev-pill-soon", label: "Sắp diễn ra" },
  READY: { cls: "ev-pill-soon", label: "Sắp diễn ra" },
  ENDED: { cls: "ev-pill-ended", label: "Đã kết thúc" },
  CANCELLED: { cls: "ev-pill-ended", label: "Đã huỷ" },
};

export default async function LiveEventsPage({
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
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="ov-title">
            Live <span>Events</span>
          </h1>
          <p className="text-dim text-[13px] mt-1">
            {draftCount > 0 ? `${draftCount} chuẩn bị` : "0 chuẩn bị"} · {events.length} tổng cộng
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
        <div className="space-y-3">
          {events.map((e) => {
            const platforms = JSON.parse(e.platforms) as string[];
            const pill = STATUS_PILL[e.status] ?? { cls: "ev-pill-ended", label: e.status };
            const desc =
              e.status === "LIVE"
                ? `Theo dõi và quản trị rủi ro cho chiến dịch livestream ${e.name}.`
                : `Chuẩn bị nội dung và kịch bản cho sự kiện livestream ${e.name}.`;
            return (
              <Link
                key={e.id}
                href={`/workspaces/${workspaceId}/live-events/${e.id}`}
                className="ev-card"
              >
                <div className={`ev-thumb ${e.status === "LIVE" ? "ev-thumb-live" : ""}`}>
                  {e.status === "LIVE" && <span className="ev-live-tag">LIVE</span>}
                  <span className="ev-thumb-logo" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="" className="w-7 h-7 opacity-80" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <span className={`ev-pill ${pill.cls}`}>
                      <span className="ev-pill-dot" />
                      {pill.label}
                    </span>
                  </div>
                  <div className="text-[16px] font-bold truncate">{e.name}</div>
                  <div className="flex items-center gap-2 flex-wrap text-[12px] text-dim mt-0.5">
                    <span className="font-medium">{e.brand.name}</span>
                    <span className="text-faint">·</span>
                    <span className="flex items-center gap-1">
                      {platforms.map((p) => (
                        <span key={p} className={`platform-dot ${PLATFORM_CLASS[p] ?? "pf-other"}`} title={p} />
                      ))}
                    </span>
                    {e.scheduledAt && (
                      <>
                        <span className="text-faint">·</span>
                        <span className="flex items-center gap-1">
                          <ClockIcon size={13} />
                          {new Date(e.scheduledAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[12.5px] text-dim mt-1.5 truncate">{desc}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-demo">{e.dataMode}</span>
                    <span className={e.status === "LIVE" ? "badge badge-live" : "badge badge-p3"}>{e.status}</span>
                  </div>
                  <span className="ev-kebab" aria-hidden>
                    <KebabIcon size={16} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
