import type { Priority } from "@/lib/constants";
import { SLA_MINUTES } from "@/lib/constants";

// SLA calculation — pure functions, test độc lập
export type SlaWindows = {
  ackDueAt: Date | null;
  actionDueAt: Date | null;
};

export function slaWindows(priority: Priority, from: Date = new Date()): SlaWindows {
  const cfg = SLA_MINUTES[priority];
  return {
    ackDueAt: cfg.ack ? new Date(from.getTime() + cfg.ack * 60_000) : null,
    actionDueAt: cfg.action ? new Date(from.getTime() + cfg.action * 60_000) : null,
  };
}

export type SlaState = "ok" | "at_risk" | "breached" | "none";

export function slaState(dueAt: Date | null, now: Date = new Date()): SlaState {
  if (!dueAt) return "none";
  const diff = dueAt.getTime() - now.getTime();
  if (diff <= 0) return "breached";
  if (diff <= 60_000) return "at_risk"; // còn dưới 1 phút
  return "ok";
}

export function slaRemainingMs(dueAt: Date | null, now: Date = new Date()): number | null {
  if (!dueAt) return null;
  return dueAt.getTime() - now.getTime();
}

// SLA compliance: % incident đạt ack đúng hạn (có SLA)
export function slaCompliance(
  incidents: Array<{ slaAckDueAt: Date | null; slaAckAt: Date | null }>,
): { total: number; met: number; ratio: number | null } {
  const withSla = incidents.filter((i) => i.slaAckDueAt !== null);
  if (withSla.length === 0) return { total: 0, met: 0, ratio: null };
  const met = withSla.filter(
    (i) => i.slaAckAt !== null && i.slaAckAt.getTime() <= i.slaAckDueAt!.getTime(),
  ).length;
  return { total: withSla.length, met, ratio: met / withSla.length };
}
