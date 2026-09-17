import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";

// GET /api/response-templates?workspaceId=&topic=&kind=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "template.view");
    const topic = url.searchParams.get("topic");
    const kind = url.searchParams.get("kind");

    const items = await prisma.responseTemplate.findMany({
      where: {
        workspaceId,
        ...(topic ? { situationTopic: topic } : {}),
        ...(kind ? { kind } : {}),
      },
      orderBy: { name: "asc" },
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  playbookId: z.string().nullish(),
  name: z.string().min(2).max(120),
  kind: z.enum(["comment_reply", "host_notice", "internal_notice"]).default("comment_reply"),
  situationTopic: z.string().default("other"),
  tone: z.string().max(40).default("professional"),
  body: z.string().min(5).max(2000),
  bannedClaims: z.array(z.string().max(80)).max(20).nullish(),
  approverRole: z.string().nullish(),
});

export async function POST(req: Request) {
  try {
    const input = parseBody(createSchema, await req.json());
    const ctx = await requirePermission(input.workspaceId, "template.manage");
    const tpl = await prisma.responseTemplate.create({
      data: {
        workspaceId: input.workspaceId,
        playbookId: input.playbookId ?? null,
        name: input.name,
        kind: input.kind,
        situationTopic: input.situationTopic,
        tone: input.tone,
        body: input.body,
        variables: JSON.stringify([...new Set([...input.body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]),
        bannedClaims: JSON.stringify(input.bannedClaims ?? []),
        approverRole: input.approverRole ?? null,
      },
    });
    await audit({
      workspaceId: input.workspaceId,
      actorId: ctx.user.id,
      action: "template.create",
      entityType: "response_template",
      entityId: tpl.id,
    });
    return ok(tpl, 201);
  } catch (e) {
    return fail(e);
  }
}
