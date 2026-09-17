// Shared constants — nguồn chân lý duy nhất cho mọi enum dạng string
// (SQLite không có enum native; Zod parse ở tầng API, giá trị ở đây dùng cả 2 phía)

export const WORKSPACE_ROLES = [
  "OWNER",
  "CRISIS_LEAD",
  "BRAND_MANAGER",
  "PRODUCER",
  "MODERATOR",
  "CUSTOMER_SERVICE",
  "LEGAL_REVIEWER",
  "EXEC_VIEWER",
  "ANALYST",
  "AGENCY",
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const EVENT_STATUSES = ["DRAFT", "READY", "LIVE", "ENDED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const INCIDENT_STATUSES = [
  "OPEN",
  "INVESTIGATING",
  "RESPONSE_PENDING",
  "RESPONDING",
  "MONITORING",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TOPICS = [
  "pricing",
  "shipping",
  "delivery",
  "product_claim",
  "spam",
  "praise",
  "other",
] as const;
export type Topic = (typeof TOPICS)[number];

export const RISK_TYPES = [
  "none",
  "pricing",
  "shipping",
  "delivery",
  "product_claim",
  "spam",
  "volume_spike",
] as const;
export type RiskType = (typeof RISK_TYPES)[number];

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "SNOOZED", "CONVERTED", "DISMISSED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const DRAFT_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "USED",
  "ARCHIVED",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const DATA_MODES = ["DEMO", "LIVE"] as const;
export type DataMode = (typeof DATA_MODES)[number];

export const SIM_STATES = ["STOPPED", "RUNNING", "PAUSED"] as const;
export type SimState = (typeof SIM_STATES)[number];

export const RESPONSE_KINDS = ["comment_reply", "host_notice", "internal_notice"] as const;
export type ResponseKind = (typeof RESPONSE_KINDS)[number];

export const PLATFORMS = ["facebook", "tiktok", "shopee", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

// Danh mục mặt hàng — phục vụ nhiều ngành hàng khác nhau (mỹ phẩm, F&B, thời trang...).
// Classifier + simulator đọc meta theo category; event.products lưu [{name, offer?, category}].
export const PRODUCT_CATEGORIES = [
  "cosmetics",
  "food",
  "supplement",
  "fashion",
  "electronics",
  "home",
  "mother_baby",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = "other";

// SLA mặc định (phút): P3 không có SLA
export const SLA_MINUTES: Record<Priority, { ack: number | null; action: number | null }> = {
  P0: { ack: 5, action: 15 },
  P1: { ack: 10, action: 30 },
  P2: { ack: 15, action: 60 },
  P3: { ack: null, action: null },
};

// Simulator timing
export const SIM_TICK_MS = 1000;
export const SIM_MAX_LIFETIME_TICKS = 3600; // guard chống leak: 1 giờ
export const SIM_MESSAGES_PER_TICK = 3;
