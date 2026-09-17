import { describe, it, expect } from "vitest";
import { can, approverRolesForDraft } from "@/lib/rbac";

describe("RBAC matrix", () => {
  it("OWNER có toàn quyền gồm member.manage", () => {
    expect(can("OWNER", "member.manage")).toBe(true);
    expect(can("OWNER", "response.approve")).toBe(true);
    expect(can("OWNER", "event.status")).toBe(true);
  });

  it("EXEC_VIEWER chỉ đọc — không có mutation nào", () => {
    const mutations = [
      "event.create",
      "event.status",
      "alert.acknowledge",
      "incident.create",
      "incident.resolve",
      "draft.create",
      "response.approve",
    ] as const;
    for (const m of mutations) {
      expect(can("EXEC_VIEWER", m)).toBe(false);
    }
    expect(can("EXEC_VIEWER", "report.view")).toBe(true);
    expect(can("EXEC_VIEWER", "incident.view")).toBe(true);
  });

  it("ANALYST đọc + audit nhưng không mutate", () => {
    expect(can("ANALYST", "audit.view")).toBe(true);
    expect(can("ANALYST", "alert.acknowledge")).toBe(false);
  });

  it("LEGAL_REVIEWER duyệt response nhưng không tạo event", () => {
    expect(can("LEGAL_REVIEWER", "response.approve")).toBe(true);
    expect(can("LEGAL_REVIEWER", "event.create")).toBe(false);
  });

  it("MODERATOR ack alert nhưng KHÔNG duyệt response", () => {
    expect(can("MODERATOR", "alert.acknowledge")).toBe(true);
    expect(can("MODERATOR", "response.approve")).toBe(false);
  });

  it("PRODUCER điều khiển simulator nhưng không approve", () => {
    expect(can("PRODUCER", "event.simulator")).toBe(true);
    expect(can("PRODUCER", "response.approve")).toBe(false);
  });

  it("CUSTOMER_SERVICE ack + draft nhưng không escalate", () => {
    expect(can("CUSTOMER_SERVICE", "alert.acknowledge")).toBe(true);
    expect(can("CUSTOMER_SERVICE", "draft.create")).toBe(true);
    expect(can("CUSTOMER_SERVICE", "incident.escalate")).toBe(false);
  });

  it("AGENCY tạo draft, note nhưng không đổi event status", () => {
    expect(can("AGENCY", "draft.create")).toBe(true);
    expect(can("AGENCY", "note.add")).toBe(true);
    expect(can("AGENCY", "event.status")).toBe(false);
  });

  it("CRISIS_LEAD approve + escalate + severity", () => {
    expect(can("CRISIS_LEAD", "response.approve")).toBe(true);
    expect(can("CRISIS_LEAD", "incident.escalate")).toBe(true);
    expect(can("CRISIS_LEAD", "incident.severity")).toBe(true);
  });
});

describe("approverRolesForDraft", () => {
  it("draft có claim cấm → thêm LEGAL_REVIEWER", () => {
    expect(approverRolesForDraft(1)).toContain("LEGAL_REVIEWER");
  });
  it("draft thường → Owner + Crisis Lead đủ", () => {
    expect(approverRolesForDraft(0)).toEqual(["OWNER", "CRISIS_LEAD"]);
  });
});
