import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import type { WorkspaceRole } from "@/lib/constants";
import PlaybooksManager from "./PlaybooksManager";

export const dynamic = "force-dynamic";

export default async function PlaybooksPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const playbooks = await prisma.playbook.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: { checklist: { orderBy: { position: "asc" } }, _count: { select: { liveEvents: true } } },
  });

  return (
    <PlaybooksManager
      workspaceId={workspaceId}
      role={membership.role as WorkspaceRole}
      playbooks={playbooks.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        riskKeywords: JSON.parse(p.riskKeywords || "[]") as string[],
        eventsUsing: p._count.liveEvents,
        checklist: p.checklist.map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
      }))}
    />
  );
}
