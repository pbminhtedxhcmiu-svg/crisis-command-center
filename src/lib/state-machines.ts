import { conflict } from "@/lib/errors";
import type { EventStatus, IncidentStatus, DraftStatus, Priority } from "@/lib/constants";
import { PRIORITIES } from "@/lib/constants";

// State machines — nguồn chân lý cho transition hợp lệ của Event / Incident / Draft

export const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["LIVE", "CANCELLED", "DRAFT"],
  LIVE: ["ENDED"],
  ENDED: [],
  CANCELLED: [],
};

export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ["INVESTIGATING", "RESPONSE_PENDING", "RESPONDING", "RESOLVED"],
  INVESTIGATING: ["RESPONSE_PENDING", "RESPONDING", "RESOLVED"],
  RESPONSE_PENDING: ["RESPONDING", "INVESTIGATING", "RESOLVED"],
  RESPONDING: ["MONITORING", "RESOLVED"],
  MONITORING: ["RESOLVED", "RESPONDING"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: [],
  REOPENED: ["INVESTIGATING", "RESPONSE_PENDING", "RESPONDING", "RESOLVED"],
};

export const DRAFT_TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "ARCHIVED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED"],
  APPROVED: ["USED", "ARCHIVED"],
  REJECTED: ["DRAFT"], // edit lại thành draft
  USED: [],
  ARCHIVED: [],
};

export function assertEventTransition(from: EventStatus, to: EventStatus) {
  if (!EVENT_TRANSITIONS[from]?.includes(to)) {
    throw conflict(`Không thể chuyển event từ ${from} sang ${to}`);
  }
}

export function assertIncidentTransition(from: IncidentStatus, to: IncidentStatus) {
  if (!INCIDENT_TRANSITIONS[from]?.includes(to)) {
    throw conflict(`Không thể chuyển incident từ ${from} sang ${to}`);
  }
}

export function assertDraftTransition(from: DraftStatus, to: DraftStatus) {
  if (!DRAFT_TRANSITIONS[from]?.includes(to)) {
    throw conflict(`Không thể chuyển response draft từ ${from} sang ${to}`);
  }
}

export function severityRank(p: Priority): number {
  return PRIORITIES.indexOf(p);
}

export function canChangeSeverity(from: Priority, to: Priority): boolean {
  return severityRank(to) !== severityRank(from);
}
