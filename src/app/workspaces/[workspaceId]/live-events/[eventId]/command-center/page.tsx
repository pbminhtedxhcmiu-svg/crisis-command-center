import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import CommandCenterMonitor from "./CommandCenterMonitor";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage({
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
    include: { user: true },
  });
  if (!membership) redirect("/login");

  const event = await prisma.liveEvent.findUnique({ where: { id: eventId } });
  if (!event || event.workspaceId !== workspaceId) {
    return (
      <div className="surface p-8 max-w-lg">
        <div className="badge badge-disconnected mb-3">404</div>
        <h1 className="font-bold mb-1">Không tìm thấy event</h1>
        <Link className="btn mt-3" href={`/workspaces/${workspaceId}/live-events`}>← Về danh sách</Link>
      </div>
    );
  }

  return (
    <CommandCenterMonitor
      workspaceId={workspaceId}
      eventId={event.id}
      eventName={event.name}
      eventStatus={event.status}
      dataMode={event.dataMode}
    />
  );
}
