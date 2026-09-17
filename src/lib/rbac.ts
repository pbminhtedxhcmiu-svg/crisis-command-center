import type { WorkspaceRole } from "@/lib/constants";

export type { WorkspaceRole };

// Ma trận RBAC — nguồn chân lý duy nhất. Backend enforce ở guards,
// frontend dùng để ẩn/disable UI. Thêm action mới phải thêm vào đây.
export type PermissionAction =
  | "workspace.view"
  | "workspace.manage"
  | "member.manage"
  | "brand.manage"
  | "campaign.manage"
  | "event.view"
  | "event.create"
  | "event.update"
  | "event.status"
  | "event.simulator"
  | "alert.view"
  | "alert.acknowledge"
  | "alert.assign"
  | "alert.dismiss"
  | "incident.view"
  | "incident.create"
  | "incident.assign"
  | "incident.update"
  | "incident.severity"
  | "incident.escalate"
  | "incident.resolve"
  | "evidence.add"
  | "note.add"
  | "template.view"
  | "template.manage"
  | "draft.create"
  | "draft.requestApproval"
  | "response.approve"
  | "report.view"
  | "audit.view";

const ALL_ACTIONS: PermissionAction[] = [
  "workspace.view",
  "workspace.manage",
  "member.manage",
  "brand.manage",
  "campaign.manage",
  "event.view",
  "event.create",
  "event.update",
  "event.status",
  "event.simulator",
  "alert.view",
  "alert.acknowledge",
  "alert.assign",
  "alert.dismiss",
  "incident.view",
  "incident.create",
  "incident.assign",
  "incident.update",
  "incident.severity",
  "incident.escalate",
  "incident.resolve",
  "evidence.add",
  "note.add",
  "template.view",
  "template.manage",
  "draft.create",
  "draft.requestApproval",
  "response.approve",
  "report.view",
  "audit.view",
];

export const PERMISSIONS: Record<WorkspaceRole, PermissionAction[]> = {
  OWNER: ALL_ACTIONS,
  CRISIS_LEAD: [
    "workspace.view",
    "event.view",
    "event.create",
    "event.update",
    "event.status",
    "event.simulator",
    "alert.view",
    "alert.acknowledge",
    "alert.assign",
    "alert.dismiss",
    "incident.view",
    "incident.create",
    "incident.assign",
    "incident.update",
    "incident.severity",
    "incident.escalate",
    "incident.resolve",
    "evidence.add",
    "note.add",
    "template.view",
    "template.manage",
    "draft.create",
    "draft.requestApproval",
    "response.approve",
    "report.view",
    "audit.view",
  ],
  BRAND_MANAGER: [
    "workspace.view",
    "brand.manage",
    "campaign.manage",
    "event.view",
    "event.create",
    "event.update",
    "alert.view",
    "alert.acknowledge",
    "incident.view",
    "incident.create",
    "incident.update",
    "evidence.add",
    "note.add",
    "template.view",
    "draft.create",
    "draft.requestApproval",
    "report.view",
    "audit.view",
  ],
  PRODUCER: [
    "workspace.view",
    "event.view",
    "event.update",
    "event.status",
    "event.simulator",
    "alert.view",
    "incident.view",
    "note.add",
    "evidence.add",
    "template.view",
    "draft.create",
    "report.view",
  ],
  MODERATOR: [
    "workspace.view",
    "event.view",
    "alert.view",
    "alert.acknowledge",
    "alert.assign",
    "alert.dismiss",
    "incident.view",
    "incident.create",
    "incident.update",
    "evidence.add",
    "note.add",
    "template.view",
    "draft.create",
  ],
  CUSTOMER_SERVICE: [
    "workspace.view",
    "event.view",
    "alert.view",
    "alert.acknowledge",
    "incident.view",
    "incident.update",
    "evidence.add",
    "note.add",
    "template.view",
    "draft.create",
    "draft.requestApproval",
  ],
  LEGAL_REVIEWER: [
    "workspace.view",
    "event.view",
    "alert.view",
    "incident.view",
    "note.add",
    "template.view",
    "template.manage",
    "response.approve",
    "report.view",
    "audit.view",
  ],
  EXEC_VIEWER: ["workspace.view", "event.view", "alert.view", "incident.view", "report.view"],
  ANALYST: [
    "workspace.view",
    "event.view",
    "alert.view",
    "incident.view",
    "report.view",
    "audit.view",
  ],
  AGENCY: [
    "workspace.view",
    "event.view",
    "alert.view",
    "incident.view",
    "note.add",
    "template.view",
    "draft.create",
  ],
};

export function can(role: WorkspaceRole, action: PermissionAction): boolean {
  return PERMISSIONS[role]?.includes(action) ?? false;
}

// Response draft có claim cấm → bắt buộc thêm LEGAL_REVIEWER duyệt
export function approverRolesForDraft(bannedClaimsCount: number): WorkspaceRole[] {
  if (bannedClaimsCount > 0) return ["OWNER", "CRISIS_LEAD", "LEGAL_REVIEWER"];
  return ["OWNER", "CRISIS_LEAD"];
}
