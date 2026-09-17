import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SEV_BADGE: Record<string, string> = {
  P0: "badge badge-p0",
  P1: "badge badge-p1",
  P2: "badge badge-p2",
  P3: "badge badge-p3",
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "badge badge-p1",
  INVESTIGATING: "badge badge-p2",
  RESPONSE_PENDING: "badge badge-demo",
  RESPONDING: "badge badge-info",
  MONITORING: "badge badge-info",
  RESOLVED: "badge badge-ok",
  CLOSED: "badge badge-p3",
  REOPENED: "badge badge-p0",
};

const OPEN_STATUSES = ["OPEN", "INVESTIGATING", "RESPONSE_PENDING", "RESPONDING", "MONITORING"];

export default async function IncidentsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const incidents = await prisma.incident.findMany({
    where: { workspaceId },
    include: { event: { select: { name: true } }, owner: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const open = incidents.filter((i) => OPEN_STATUSES.includes(i.status));
  const resolved = incidents.filter((i) => !OPEN_STATUSES.includes(i.status));
  const p0p1 = open.filter((i) => i.severity === "P0" || i.severity === "P1").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Incidents</h1>
        <p className="text-dim text-[13px] mt-0.5">
          {open.length} đang mở · {p0p1} P0/P1 · {resolved.length} đã xử lý
        </p>
      </div>

      {incidents.length === 0 ? (
        <div className="surface p-12 text-center grid-lines">
          <div className="text-4xl mb-3">🗂</div>
          <div className="font-semibold mb-1">Chưa có incident nào</div>
          <p className="text-dim text-[13px] mb-5 max-w-md mx-auto">
            Incident được tạo từ alert trong Command Center khi tín hiệu đủ nghiêm trọng — bạn sẽ thấy toàn bộ vòng đời xử lý ở đây.
          </p>
          <Link className="btn btn-ghost" href={`/workspaces/${workspaceId}/live-events`}>
            📡 Xem Live Events
          </Link>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <h2 className="text-[12px] text-faint font-semibold mb-2">ĐANG MỞ</h2>
              <div className="space-y-2 mb-6">
                {open.map((i) => (
                  <IncidentRow key={i.id} i={i} workspaceId={workspaceId} />
                ))}
              </div>
            </>
          )}
          {resolved.length > 0 && (
            <>
              <h2 className="text-[12px] text-faint font-semibold mb-2">ĐÃ XỬ LÝ</h2>
              <div className="space-y-2 opacity-80">
                {resolved.map((i) => (
                  <IncidentRow key={i.id} i={i} workspaceId={workspaceId} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function IncidentRow({
  i,
  workspaceId,
}: {
  i: {
    id: string;
    code: string;
    title: string;
    severity: string;
    status: string;
    createdAt: Date;
    event: { name: string } | null;
    owner: { name: string | null; email: string } | null;
  };
  workspaceId: string;
}) {
  return (
    <Link href={`/workspaces/${workspaceId}/incidents/${i.id}`} className="surface card-hover block p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={SEV_BADGE[i.severity] ?? "badge"}>{i.severity}</span>
            <span className="font-semibold text-[14px] truncate">{i.title}</span>
          </div>
          <div className="text-dim text-[12px] flex items-center gap-2 flex-wrap">
            <span className="tabular text-faint">{i.code}</span>
            <span className="text-faint">·</span>
            <span>{i.event?.name ?? "—"}</span>
            <span className="text-faint">·</span>
            <span>👤 {i.owner?.name ?? i.owner?.email ?? "chưa gán"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-faint text-[11.5px]">{i.createdAt.toLocaleDateString("vi-VN")}</span>
          <span className={STATUS_BADGE[i.status] ?? "badge badge-p3"}>{i.status}</span>
        </div>
      </div>
    </Link>
  );
}
