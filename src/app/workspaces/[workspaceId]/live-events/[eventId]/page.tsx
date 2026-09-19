import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import EventDetailActions from "./EventDetailActions";
import LinkstreamEditor from "./LinkstreamEditor";
import PreLiveChecklist from "./PreLiveChecklist";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; eventId: string }>;
}) {
  const { workspaceId, eventId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const event = await prisma.liveEvent.findFirst({
    where: { id: eventId, workspaceId },
    include: {
      brand: true,
      campaign: true,
      playbook: { include: { checklist: { orderBy: { position: "asc" as const } } } },
      _count: { select: { messages: true, alerts: true, incidents: true } },
    },
  });
  if (!event) notFound();

  const platforms = JSON.parse(event.platforms) as string[];
  const riskKeywords = JSON.parse(event.riskKeywords) as string[];
  let streamUrls: Record<string, string> = {};
  try {
    streamUrls = JSON.parse(event.streamUrls ?? "{}") as Record<string, string>;
  } catch {
    streamUrls = {};
  }
  let products: { name: string; offer?: string }[] = [];
  try {
    products = JSON.parse(event.products ?? "[]") as { name: string; offer?: string }[];
  } catch {
    products = [];
  }

  const checklistState = JSON.parse(event.checklistState ?? "{}") as Record<string, boolean>;
  const playbookChecklist = event.playbook?.checklist ?? [];
  const checkedCount = playbookChecklist.filter((c) => checklistState[c.id]).length;

  const readiness = [
    { ok: !!(event.hostUserId || event.producerUserId), label: "Người chịu trách nhiệm" },
    { ok: platforms.length > 0, label: "Nguồn dữ liệu / demo source" },
    { ok: riskKeywords.length > 0, label: "Risk keywords" },
    { ok: !!event.playbook, label: "Playbook" },
    { ok: playbookChecklist.length === 0 || checkedCount === playbookChecklist.length, label: "Checklist trước live" },
  ];
  const readyCount = readiness.filter((r) => r.ok).length;

  const statusBadge =
    event.status === "LIVE"
      ? "badge badge-live"
      : event.status === "DRAFT"
        ? "badge badge-p3"
        : event.status === "CANCELLED"
          ? "badge badge-disconnected"
          : "badge badge-demo";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="breadcrumb mb-4">
        <Link href={`/workspaces/${workspaceId}/live-events`}>Live Events</Link>
        <span className="sep">/</span>
        <span className="crumb-current">{event.name}</span>
      </div>

      <div className="surface card-hover p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">{event.name}</h1>
              <span className={statusBadge}>
                {event.status === "LIVE" && <span className="status-dot status-live" style={{ width: 6, height: 6 }} />}
                {event.status}
              </span>
              <span className="badge badge-demo">{event.dataMode}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap text-[12.5px] text-dim">
              <span className="font-medium">{event.brand.name}</span>
              {event.campaign && <><span className="text-faint">·</span><span>{event.campaign.name}</span></>}
              {event.scheduledAt && (
                <>
                  <span className="text-faint">·</span>
                  <span>🕒 {new Date(event.scheduledAt).toLocaleString("vi-VN")}</span>
                </>
              )}
            </div>
          </div>
          <EventDetailActions
            eventId={event.id}
            workspaceId={workspaceId}
            status={event.status}
          />
        </div>

        {products.length > 0 && (
          <p className="text-dim text-[13px] mt-3">
            🛍 Sản phẩm / offer: {products.map((p) => p.name + (p.offer ? ` — ${p.offer}` : "")).join(" · ")}
          </p>
        )}

        <LinkstreamEditor
          eventId={event.id}
          platforms={platforms}
          initialUrls={streamUrls}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="surface-2 p-3">
            <div className="text-faint text-[10.5px] font-semibold mb-1">MESSAGES</div>
            <div className="text-xl font-bold tabular">{event._count.messages}</div>
          </div>
          <div className="surface-2 p-3">
            <div className="text-faint text-[10.5px] font-semibold mb-1">ALERTS</div>
            <div className="text-xl font-bold tabular">{event._count.alerts}</div>
          </div>
          <div className="surface-2 p-3">
            <div className="text-faint text-[10.5px] font-semibold mb-1">INCIDENTS</div>
            <div className="text-xl font-bold tabular">{event._count.incidents}</div>
          </div>
          <div className="surface-2 p-3">
            <div className="text-faint text-[10.5px] font-semibold mb-1">PLATFORMS</div>
            <div className="flex gap-1.5 mt-1.5">
              {platforms.map((p) => (
                <span key={p} className="badge badge-p3 text-[10.5px]">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {event.playbook && playbookChecklist.length > 0 && (
        <PreLiveChecklist
          eventId={event.id}
          playbookName={event.playbook.name}
          items={playbookChecklist.map((c) => ({ id: c.id, label: c.label, detail: c.detail }))}
          initialState={checklistState}
        />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="surface card-hover p-5">
          <h2 className="text-[14px] font-bold mb-3 flex items-center justify-between">
            Readiness checklist
            <span className={readyCount === readiness.length ? "text-ok text-[12px]" : "text-warn text-[12px]"}>
              {readyCount}/{readiness.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {readiness.map((r) => (
              <li key={r.label} className="flex items-center gap-2.5 text-[13px]">
                <span className={r.ok ? "text-ok" : "text-warn"}>{r.ok ? "✓" : "○"}</span>
                <span className={r.ok ? "" : "text-dim"}>{r.label}</span>
              </li>
            ))}
          </ul>
          {riskKeywords.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <div className="text-faint text-[10.5px] font-semibold mb-2">RISK KEYWORDS</div>
              <div className="flex flex-wrap gap-1.5">
                {riskKeywords.map((k) => (
                  <span key={k} className="badge badge-p2 text-[11px]">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="surface card-hover p-5">
          <h2 className="text-[14px] font-bold mb-3">Playbook</h2>
          {!event.playbook ? (
            <p className="text-dim text-[13px]">Chưa gắn playbook nào.</p>
          ) : (
            <div className="surface-2 p-3">
              <div className="text-[13px] font-semibold">{event.playbook.name}</div>
              {event.playbook.description && (
                <div className="text-[12px] text-dim mt-0.5">{event.playbook.description}</div>
              )}
              {playbookChecklist.length > 0 && (
                <div className="text-faint text-[11.5px] mt-1.5">{playbookChecklist.length} mục checklist — tick ở panel bên trái</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <Link
          className="btn btn-primary flex-1 justify-center"
          href={`/workspaces/${workspaceId}/live-events/${event.id}/command-center`}
        >
          🎛 Mở Command Center
        </Link>
        <Link
          className="btn btn-ghost flex-1 justify-center"
          href={`/workspaces/${workspaceId}/live-events/${event.id}/report`}
        >
          📊 Xem report
        </Link>
      </div>
    </div>
  );
}
