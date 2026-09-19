import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ok, fail, parseBody } from "@/lib/http";
import { audit } from "@/lib/audit";

// ===== Playbook 'Rủi ro phát ngôn host/KOL' + playbook tuỳ chỉnh =====
// checklist: [{label, detail?}] — lưu bảng con PlaybookChecklistItem (đọc-ghim trước giờ live).
// riskKeywords: string[] — bơm vào pipeline phát hiện (classifier + simulator alert).
function serialize(p: {
  riskKeywords: string;
  checklist?: { id: string; position: number; label: string; detail: string | null }[];
  [k: string]: unknown;
}) {
  return {
    ...p,
    riskKeywords: JSON.parse(p.riskKeywords) as string[],
    checklist: (p.checklist ?? []).map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
  };
}

// GET /api/playbooks?workspaceId=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return ok({ items: [] });
    await requirePermission(workspaceId, "workspace.view");
    const items = await prisma.playbook.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { checklist: { orderBy: { position: "asc" } } },
    });
    return ok({ items: items.map(serialize) });
  } catch (e) {
    return fail(e);
  }
}

const checklistItem = z.object({ label: z.string().min(1).max(160), detail: z.string().max(500).optional() });

const upsertSchema = z.object({
  id: z.string().optional(), // có id = update
  workspaceId: z.string().min(1),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  checklist: z.array(checklistItem).max(30).optional(),
  riskKeywords: z.array(z.string().min(1).max(60)).max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const input = parseBody(upsertSchema, await req.json());
    const ctx = await requirePermission(input.workspaceId, "playbook.manage");

    const data = {
      name: input.name,
      description: input.description ?? null,
      riskKeywords: JSON.stringify(input.riskKeywords ?? []),
    };

    const playbook = input.id
      ? await prisma.playbook.update({ where: { id: input.id }, data })
      : await prisma.playbook.create({ data: { workspaceId: input.workspaceId, ...data } });

    // Đồng bộ bảng con checklist items (xoá rồi tạo lại — checklist nhỏ, đơn giản & đúng thứ tự)
    await prisma.playbookChecklistItem.deleteMany({ where: { playbookId: playbook.id } });
    if (input.checklist && input.checklist.length > 0) {
      await prisma.playbookChecklistItem.createMany({
        data: input.checklist.map((c, i) => ({
          playbookId: playbook.id,
          position: i,
          label: c.label,
          detail: c.detail ?? null,
        })),
      });
    }

    const full = await prisma.playbook.findUniqueOrThrow({
      where: { id: playbook.id },
      include: { checklist: { orderBy: { position: "asc" } } },
    });

    await audit({
      workspaceId: ctx.workspaceId,
      actorId: ctx.user.id,
      action: input.id ? "playbook.update" : "playbook.create",
      entityType: "playbook",
      entityId: playbook.id,
      detail: { name: playbook.name, checklistItems: input.checklist?.length ?? 0, keywords: input.riskKeywords?.length ?? 0 },
    });
    return ok(serialize(full), input.id ? 200 : 201);
  } catch (e) {
    return fail(e);
  }
}

const deleteSchema = z.object({ workspaceId: z.string().min(1), id: z.string().min(1) });

export async function DELETE(req: Request) {
  try {
    const input = parseBody(deleteSchema, await req.json());
    const ctx = await requirePermission(input.workspaceId, "playbook.manage");
    const existing = await prisma.playbook.findUnique({ where: { id: input.id } });
    if (!existing || existing.workspaceId !== input.workspaceId) throw notFound("Không tìm thấy playbook");
    await prisma.playbook.delete({ where: { id: input.id } });
    await audit({
      workspaceId: ctx.workspaceId,
      actorId: ctx.user.id,
      action: "playbook.delete",
      entityType: "playbook",
      entityId: input.id,
      detail: { name: existing.name },
    });
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
