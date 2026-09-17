import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const ev = await p.liveEvent.findFirst({ where: { name: { contains: "Flash Sale" } }, select: { id: true } });
const byStatus = await p.alert.groupBy({ by: ["status"], where: { eventId: ev.id }, _count: true });
console.log("ALERT STATUS:", byStatus.map(s => `${s.status}=${s._count}`).join(", "));
const acked = await p.alert.findFirst({ where: { eventId: ev.id, status: "ACKNOWLEDGED" }, select: { acknowledgedAt: true } });
console.log("ACK TIME SET:", acked?.acknowledgedAt !== null && acked?.acknowledgedAt !== undefined);
await p.$disconnect();
