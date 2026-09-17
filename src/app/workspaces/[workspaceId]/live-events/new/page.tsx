import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";
import NewEventForm from "./NewEventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) redirect("/login");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) redirect("/login");

  const [brands, campaigns, members, playbooks] = await Promise.all([
    prisma.brand.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    prisma.campaign.findMany({ where: { workspaceId }, select: { id: true, name: true, brandId: true } }),
    prisma.membership.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.playbook.findMany({
      where: { workspaceId },
      select: { id: true, name: true, description: true },
    }),
  ]);

  return (
    <NewEventForm
      workspaceId={workspaceId}
      brands={brands}
      campaigns={campaigns}
      members={members}
      playbooks={playbooks}
    />
  );
}
