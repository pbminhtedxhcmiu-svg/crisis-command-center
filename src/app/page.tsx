import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";

export default async function Home() {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { memberships: { include: { workspace: true } } } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.memberships.length === 0) {
    redirect("/login");
  }
  redirect(`/workspaces/${session.user.memberships[0].workspaceId}/live-events`);
}
