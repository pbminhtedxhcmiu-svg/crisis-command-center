import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound, validationError } from "@/lib/errors";
import { ok, fail, parseBody, idempotent } from "@/lib/http";
import {
  assignIncident,
  changeIncidentStatus,
  changeSeverity,
  escalateIncident,
  addEvidence,
  addNote,
  acknowledgeIncident,
} from "@/server/services/incidents";
import type { IncidentStatus, Priority } from "@/lib/constants";

type Params = { params: Promise<{ incidentId: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), userId: z.string().min(1), role: z.enum(["owner", "support", "reviewer"]).default("owner"), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("status"), to: z.enum(["OPEN", "INVESTIGATING", "RESPONSE_PENDING", "RESPONDING", "MONITORING", "RESOLVED", "CLOSED", "REOPENED"]), resolution: z.string().max(500).optional(), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("severity"), severity: z.enum(["P0", "P1", "P2", "P3"]), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("ack"), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("escalate"), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("resolve"), resolution: z.string().max(500).optional(), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("reopen"), reason: z.string().max(500).optional(), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("evidence"), kind: z.enum(["alert", "message", "note", "link", "file"]), content: z.string().min(1).max(2000), refId: z.string().optional(), requestKey: z.string().max(80).optional() }),
  z.object({ action: z.literal("note"), body: z.string().min(1).max(2000), requestKey: z.string().max(80).optional() }),
]);

// POST /api/incidents/:id/actions — điểm vào duy nhất cho mọi mutation của incident
export async function POST(req: Request, { params }: Params) {
  try {
    const { incidentId } = await params;
    const input = parseBody(schema, await req.json());
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw notFound("Không tìm thấy incident");
    const wsId = incident.workspaceId;

    switch (input.action) {
      case "assign": {
        const ctx = await requirePermission(wsId, "incident.assign");
        return ok(await idempotent(input.requestKey, () => assignIncident(ctx, incidentId, input.userId, input.role)));
      }
      case "status": {
        const ctx = await requirePermission(wsId, "incident.update");
        return ok(await idempotent(input.requestKey, () =>
          changeIncidentStatus(ctx, incidentId, input.to as IncidentStatus, { resolution: input.resolution }),
        ));
      }
      case "severity": {
        const ctx = await requirePermission(wsId, "incident.severity");
        return ok(await idempotent(input.requestKey, () => changeSeverity(ctx, incidentId, input.severity as Priority)));
      }
      case "ack": {
        const ctx = await requirePermission(wsId, "incident.update");
        return ok(await idempotent(input.requestKey, () => acknowledgeIncident(ctx, incidentId)));
      }
      case "escalate": {
        const ctx = await requirePermission(wsId, "incident.escalate");
        return ok(await idempotent(input.requestKey, () => escalateIncident(ctx, incidentId)));
      }
      case "resolve": {
        const ctx = await requirePermission(wsId, "incident.resolve");
        return ok(await idempotent(input.requestKey, () =>
          changeIncidentStatus(ctx, incidentId, "RESOLVED", { resolution: input.resolution ?? "Đã xử lý xong" }),
        ));
      }
      case "reopen": {
        const ctx = await requirePermission(wsId, "incident.update");
        return ok(await idempotent(input.requestKey, () =>
          changeIncidentStatus(ctx, incidentId, "REOPENED", { resolution: input.reason }),
        ));
      }
      case "evidence": {
        const ctx = await requirePermission(wsId, "evidence.add");
        return ok(await idempotent(input.requestKey, () => addEvidence(ctx, incidentId, input)));
      }
      case "note": {
        const ctx = await requirePermission(wsId, "note.add");
        return ok(await idempotent(input.requestKey, () => addNote(ctx, incidentId, input.body)));
      }
      default:
        throw validationError("Action không được hỗ trợ");
    }
  } catch (e) {
    return fail(e);
  }
}
