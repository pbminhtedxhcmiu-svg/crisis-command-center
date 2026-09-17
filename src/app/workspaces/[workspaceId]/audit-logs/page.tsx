import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CAN_VIEW = ["OWNER", "CRISIS_LEAD", "BRAND_MANAGER", "LEGAL_REVIEWER", "ANALYST"];

export default async function AuditLogsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  if (!CAN_VIEW.includes(membership.role)) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="surface p-8 text-center">
          <div className="text-3xl mb-3">🔒</div>
          <div className="badge badge-disconnected mb-3">403</div>
          <h1 className="font-bold mb-1">Không có quyền xem audit logs</h1>
          <p className="text-dim text-[12.5px]">Chỉ Owner, Crisis Lead, Brand Manager, Legal và Analyst xem được trang này.</p>
        </div>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { workspaceId },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-dim text-[13px] mt-0.5">100 hành động gần nhất — bằng chứng quyết định cho compliance.</p>
      </div>

      {logs.length === 0 ? (
        <div className="surface p-12 text-center grid-lines">
          <div className="text-4xl mb-3">🛡</div>
          <div className="font-semibold mb-1">Chưa có hành động nào được ghi</div>
          <p className="text-dim text-[13px]">Mọi mutation trong workspace sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-faint border-b border-[var(--border)] text-[10.5px] tracking-wide">
                <th className="px-4 py-2.5 font-semibold">THỜI GIAN</th>
                <th className="px-4 py-2.5 font-semibold">ACTOR</th>
                <th className="px-4 py-2.5 font-semibold">HÀNH ĐỘNG</th>
                <th className="px-4 py-2.5 font-semibold">ĐỐI TƯỢNG</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-2.5 text-faint whitespace-nowrap tabular">{new Date(l.createdAt).toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-2.5 font-medium">{l.actor?.name ?? l.actor?.email ?? "system"}</td>
                  <td className="px-4 py-2.5"><span className="badge badge-p3">{l.action}</span></td>
                  <td className="px-4 py-2.5 text-dim tabular">{l.entityType}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
