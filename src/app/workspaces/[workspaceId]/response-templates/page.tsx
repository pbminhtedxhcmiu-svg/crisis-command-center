import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import ResponseStudio from "./ResponseStudio";

export const dynamic = "force-dynamic";

export default async function ResponseTemplatesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const templates = await prisma.responseTemplate.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const drafts = await prisma.responseDraft.findMany({
    where: { workspaceId },
    include: { template: { select: { name: true } }, incident: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <ResponseStudio
      role={membership.role}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        situation: t.situationTopic,
        channel: t.channel,
        tone: t.tone,
        body: t.body,
        bannedClaims: JSON.parse(t.bannedClaims || "[]") as string[],
        version: t.version,
        status: t.status,
      }))}
      drafts={drafts.map((d) => ({
        id: d.id,
        title: d.title,
        templateName: d.template?.name ?? "—",
        incidentTitle: d.incident?.title ?? "—",
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
