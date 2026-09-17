import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const ws = await p.workspace.findMany({ select: { id: true, name: true, _count: { select: { liveEvents: true, brands: true, playbooks: true, responseTemplates: true, memberships: true } } } });
for (const w of ws) console.log("WS:", w.id, w.name, JSON.stringify(w._count));
const events = await p.liveEvent.findMany({ select: { id: true, name: true, status: true, workspaceId: true, _count: { select: { messages: true, alerts: true, incidents: true } } }, orderBy: { createdAt: "desc" } });
for (const e of events) console.log("EV:", e.name.slice(0, 42), e.status, `msg=${e._count.messages} al=${e._count.alerts} inc=${e._count.incidents}`, e.id);
await p.$disconnect();
