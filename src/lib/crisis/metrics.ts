import type { Priority } from "@/lib/constants";
import { slaCompliance } from "@/lib/sla";

// Mọi metric là pure function — có định nghĩa rõ ràng, đủ dữ liệu mới tính.
export type Metric<T> = { value: T | null; note?: "not_enough_data" };

const NOT_ENOUGH = (min: number, actual: number) => (actual >= min ? null : "not_enough_data" as const);

export function messageVolume(messages: Array<{ createdAt: Date }>): Metric<number> {
  const note = NOT_ENOUGH(1, messages.length);
  return { value: note ? null : messages.length, note: note ?? undefined };
}

// Velocity: messages/phút trong cửa sổ 5 phút gần nhất
export function messageVelocity(
  messages: Array<{ createdAt: Date }>,
  now: Date = new Date(),
): Metric<number> {
  const windowStart = now.getTime() - 5 * 60_000;
  const inWindow = messages.filter((m) => m.createdAt.getTime() >= windowStart);
  if (inWindow.length < 2) return { value: null, note: "not_enough_data" };
  return { value: Math.round((inWindow.length / 5) * 10) / 10 };
}

export function severityDistribution(alerts: Array<{ priority: string }>): Record<Priority, number> {
  const dist: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const a of alerts) if (a.priority in dist) dist[a.priority as Priority] += 1;
  return dist;
}

export function incidentStatusDistribution(incidents: Array<{ status: string }>): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const i of incidents) dist[i.status] = (dist[i.status] ?? 0) + 1;
  return dist;
}

// Detection time: alert đầu tiên trừ lúc event start (giây)
export function detectionTime(
  alerts: Array<{ createdAt: Date }>,
  eventStartedAt: Date | null,
): Metric<number> {
  if (!eventStartedAt || alerts.length === 0) return { value: null, note: "not_enough_data" };
  const first = Math.min(...alerts.map((a) => a.createdAt.getTime()));
  return { value: Math.max(0, Math.round((first - eventStartedAt.getTime()) / 1000)) };
}

// MTTA: mean time to acknowledge (giây)
export function acknowledgeTime(alerts: Array<{ acknowledgedAt: Date | null; createdAt: Date }>): Metric<number> {
  const acked = alerts.filter((a) => a.acknowledgedAt);
  if (acked.length === 0) return { value: null, note: "not_enough_data" };
  const total = acked.reduce((s, a) => s + (a.acknowledgedAt!.getTime() - a.createdAt.getTime()), 0);
  return { value: Math.round(total / acked.length / 1000) };
}

// First response time: draft APPROVED/USED đầu tiên (giây, tính tới hiện tại)
export function firstResponseTime(
  drafts: Array<{ status: string; updatedAt: Date; createdAt: Date }>,
  now: Date = new Date(),
): Metric<number> {
  const approved = drafts.filter((d) => d.status === "APPROVED" || d.status === "USED");
  if (approved.length === 0) return { value: null, note: "not_enough_data" };
  const first = Math.min(...approved.map((d) => d.updatedAt.getTime()));
  return { value: Math.max(0, Math.round((first - now.getTime()) / 1000)) };
}

// MTTR: mean time to resolve (giây)
export function resolutionTime(incidents: Array<{ resolvedAt: Date | null; createdAt: Date }>): Metric<number> {
  const resolved = incidents.filter((i) => i.resolvedAt);
  if (resolved.length === 0) return { value: null, note: "not_enough_data" };
  const total = resolved.reduce((s, i) => s + (i.resolvedAt!.getTime() - i.createdAt.getTime()), 0);
  return { value: Math.round(total / resolved.length / 1000) };
}

export function topicShare(messages: Array<{ topic: string }>): Array<{ topic: string; count: number; share: number }> {
  if (messages.length === 0) return [];
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.topic, (counts.get(m.topic) ?? 0) + 1);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count, share: Math.round((count / messages.length) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function platformShare(messages: Array<{ platform: string }>): Array<{ platform: string; count: number; share: number }> {
  if (messages.length === 0) return [];
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.platform, (counts.get(m.platform) ?? 0) + 1);
  return [...counts.entries()]
    .map(([platform, count]) => ({ platform, count, share: Math.round((count / messages.length) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export { slaCompliance };
