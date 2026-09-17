import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import IncidentActions from "./IncidentActions";

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

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; incidentId: string }>;
}) {
  const { workspaceId, incidentId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
    include: { user: true },
  });
  if (!membership) redirect("/login");

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      event: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      assignments: { include: { user: { select: { name: true, email: true } } } },
      evidence: { orderBy: { createdAt: "asc" } },
      notes: { include: { author: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      timeline: { orderBy: { createdAt: "asc" } },
      drafts: { include: { template: true, author: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      approvals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!incident || incident.workspaceId !== workspaceId) {
    return (
      <div className="surface p-8 max-w-lg">
        <div className="badge badge-disconnected mb-3">404</div>
        <h1 className="font-bold mb-1">Không tìm thấy incident</h1>
        <Link className="btn mt-3" href={`/workspaces/${workspaceId}/incidents`}>← Về danh sách</Link>
      </div>
    );
  }

  const members = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true },
  });
  const templates = await prisma.responseTemplate.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { id: true, name: true, kind: true },
  });
  const draftIds = incident.drafts.map((d) => d.id);
  const notifications = await prisma.notification.findMany({
    where: {
      workspaceId,
      OR: [{ refId: incident.id }, ...(draftIds.length > 0 ? [{ refId: { in: draftIds } }] : [])],
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const auditEntries = await prisma.auditLog.findMany({
    where: { workspaceId, OR: [{ entityId: incident.id }, ...(draftIds.length > 0 ? [{ entityType: "response_draft", entityId: { in: draftIds } }] : [])] },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const ackLeft = incident.slaAckDueAt ? Math.round((new Date(incident.slaAckDueAt).getTime() - Date.now()) / 60000) : null;
  const actionLeft = incident.slaActionDueAt ? Math.round((new Date(incident.slaActionDueAt).getTime() - Date.now()) / 60000) : null;
  const pendingApprovalByDraft = new Map(
    incident.approvals.filter((a) => a.status === "PENDING").map((a) => [a.draftId, a]),
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="breadcrumb mb-4">
        <Link href={`/workspaces/${workspaceId}/incidents`}>Incidents</Link>
        <span className="sep">/</span>
        <span className="crumb-current tabular">{incident.code}</span>
      </div>

      {/* header card */}
      <div className="surface card-hover p-5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={SEV_BADGE[incident.severity]}>{incident.severity}</span>
              <h1 className="text-lg font-bold tracking-tight">{incident.title}</h1>
              <span className={STATUS_BADGE[incident.status] ?? "badge badge-p3"}>{incident.status}</span>
            </div>
            <p className="text-dim text-[12.5px]">
              {incident.event?.name ?? "—"} · <span className="tabular">{incident.code}</span> · Tạo {new Date(incident.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
        {incident.summary && <p className="text-[13px] mt-3 text-dim">{incident.summary}</p>}
      </div>

      {/* SLA tiles */}
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <div className={`surface kpi-tile p-4 ${ackLeft !== null && !incident.slaAckAt && ackLeft <= 0 ? "sla-breach" : ""}`}>
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">SLA ACKNOWLEDGE</div>
          {ackLeft === null ? (
            <span className="text-dim text-[13px]">—</span>
          ) : incident.slaAckAt ? (
            <span className="text-ok text-[15px] font-bold">✓ Đã ack</span>
          ) : ackLeft <= 0 ? (
            <span className="text-danger text-[15px] font-bold">⏰ Quá hạn {Math.abs(ackLeft)}m</span>
          ) : (
            <span className="text-[15px] font-bold tabular">Còn {ackLeft}m</span>
          )}
        </div>
        <div className={`surface kpi-tile p-4 ${actionLeft !== null && !incident.resolvedAt && actionLeft <= 0 ? "sla-breach" : ""}`}>
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">SLA ACTION</div>
          {actionLeft === null ? (
            <span className="text-dim text-[13px]">—</span>
          ) : incident.resolvedAt ? (
            <span className="text-ok text-[15px] font-bold">✓ Đã resolve</span>
          ) : actionLeft <= 0 ? (
            <span className="text-danger text-[15px] font-bold">⏰ Quá hạn {Math.abs(actionLeft)}m</span>
          ) : (
            <span className="text-[15px] font-bold tabular">Còn {actionLeft}m</span>
          )}
        </div>
        <div className="surface kpi-tile p-4">
          <div className="text-faint text-[10.5px] font-semibold mb-1.5">OWNER & ASSIGNEES</div>
          <div className="text-[13px]">
            👤 <b>{incident.owner?.name ?? incident.owner?.email ?? "chưa gán"}</b>
          </div>
          <div className="text-[11.5px] text-dim mt-1">
            {incident.assignments.length > 0
              ? incident.assignments.map((a) => `${a.user.name ?? a.user.email} (${a.role})`).join(", ")
              : "Chưa có assignee"}
          </div>
        </div>
      </div>

      <IncidentActions
        incidentId={incident.id}
        workspaceId={workspaceId}
        status={incident.status}
        severity={incident.severity}
        ownerId={incident.ownerId}
        role={membership.role}
        currentUserId={membership.user.id}
        members={members.map((m) => ({ id: m.user.id, label: m.user.name ?? m.user.email, role: m.role }))}
        templates={templates}
        drafts={incident.drafts.map((d) => ({
          id: d.id,
          title: d.title,
          body: d.body,
          status: d.status,
          templateName: d.template?.name ?? null,
          authorName: d.author.name ?? d.author.email,
          hasPendingApproval: pendingApprovalByDraft.has(d.id),
          rejectReason: d.rejectReason,
        }))}
      />

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        <div className="surface p-4">
          <div className="text-[11px] text-faint font-semibold mb-2">EVIDENCE ({incident.evidence.length})</div>
          {incident.evidence.length === 0 ? (
            <p className="text-dim text-[12.5px]">Chưa có evidence nào.</p>
          ) : (
            <ul className="space-y-2 text-[13px]">
              {incident.evidence.map((ev) => (
                <li key={ev.id} className="border-l-2 border-[var(--accent)] pl-2.5 py-0.5">
                  <div className="text-faint text-[11px]">
                    {new Date(ev.createdAt).toLocaleTimeString("vi-VN", { hour12: false })} · {ev.kind}
                    {ev.refId ? ` · ${ev.refId.slice(0, 10)}` : ""}
                  </div>
                  <div className="break-words">{ev.content}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface p-4">
          <div className="text-[11px] text-faint font-semibold mb-2">TIMELINE ({incident.timeline.length})</div>
          {incident.timeline.length === 0 ? (
            <p className="text-dim text-[12.5px]">Chưa có sự kiện nào.</p>
          ) : (
            <ol className="space-y-1.5 text-[12.5px]">
              {incident.timeline.map((t) => (
                <li key={t.id} className="flex gap-2.5">
                  <span className="text-faint tabular shrink-0">{new Date(t.createdAt).toLocaleTimeString("vi-VN", { hour12: false })}</span>
                  <span>
                    <b>{t.action}</b>
                    {t.detail ? ` — ${t.detail}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="surface p-4 mt-3">
        <div className="text-[11px] text-faint font-semibold mb-2">GHI CHÚ NỘI BỘ ({incident.notes.length})</div>
        {incident.notes.length === 0 ? (
          <p className="text-dim text-[12.5px]">Chưa có ghi chú nào.</p>
        ) : (
          <ul className="space-y-2.5 text-[13px]">
            {incident.notes.map((n) => (
              <li key={n.id} className="border-b border-[var(--border)] pb-2.5 last:border-0 last:pb-0">
                <b>{n.author.name ?? n.author.email}</b>
                <span className="text-faint text-[11px]"> · {new Date(n.createdAt).toLocaleString("vi-VN")}</span>
                <div className="mt-0.5">{n.body}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="surface p-4">
          <div className="text-[11px] text-faint font-semibold mb-2">AUDIT LOG (20 gần nhất)</div>
          {auditEntries.length === 0 ? (
            <p className="text-dim text-[12.5px]">Chưa có hành động nào được ghi.</p>
          ) : (
            <ul className="space-y-1 text-[11.5px] text-dim">
              {auditEntries.map((a) => (
                <li key={a.id}>
                  <span className="tabular">{new Date(a.createdAt).toLocaleString("vi-VN")}</span> — <b className="text-[var(--text)]">{a.actor?.name ?? a.actor?.email ?? "system"}</b> {a.action}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface p-4">
          <div className="text-[11px] text-faint font-semibold mb-2">THÔNG BÁO ({notifications.length})</div>
          {notifications.length === 0 ? (
            <p className="text-dim text-[12.5px]">Chưa có notification nào.</p>
          ) : (
            <ul className="space-y-1 text-[11.5px] text-dim">
              {notifications.map((n) => (
                <li key={n.id}>
                  <span className="tabular">{new Date(n.createdAt).toLocaleString("vi-VN")}</span> → <b className="text-[var(--text)]">{n.user.name ?? n.user.email}</b> [{n.type}] {n.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
