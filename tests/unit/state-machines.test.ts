import { describe, it, expect } from "vitest";
import {
  assertEventTransition,
  assertIncidentTransition,
  assertDraftTransition,
  canChangeSeverity,
} from "@/lib/state-machines";

describe("Event transitions", () => {
  it("DRAFT → READY hợp lệ", () => expect(() => assertEventTransition("DRAFT", "READY")).not.toThrow());
  it("READY → LIVE hợp lệ", () => expect(() => assertEventTransition("READY", "LIVE")).not.toThrow());
  it("LIVE → ENDED hợp lệ", () => expect(() => assertEventTransition("LIVE", "ENDED")).not.toThrow());
  it("DRAFT → LIVE KHÔNG hợp lệ", () => expect(() => assertEventTransition("DRAFT", "LIVE")).toThrow("Không thể chuyển"));
  it("ENDED → mọi thứ đều cấm", () => expect(() => assertEventTransition("ENDED", "DRAFT")).toThrow("Không thể chuyển"));
  it("CANCELLED kết thúc", () => expect(() => assertEventTransition("CANCELLED", "READY")).toThrow("Không thể chuyển"));
});

describe("Incident transitions", () => {
  it("OPEN → INVESTIGATING hợp lệ", () => expect(() => assertIncidentTransition("OPEN", "INVESTIGATING")).not.toThrow());
  it("RESPONDING → MONITORING → RESOLVED", () => {
    expect(() => assertIncidentTransition("RESPONDING", "MONITORING")).not.toThrow();
    expect(() => assertIncidentTransition("MONITORING", "RESOLVED")).not.toThrow();
  });
  it("RESOLVED → REOPENED hợp lệ", () => expect(() => assertIncidentTransition("RESOLVED", "REOPENED")).not.toThrow());
  it("CLOSED là terminal", () => expect(() => assertIncidentTransition("CLOSED", "OPEN")).toThrow("Không thể chuyển"));
  it("OPEN → CLOSED trực tiếp cấm", () => expect(() => assertIncidentTransition("OPEN", "CLOSED")).toThrow("Không thể chuyển"));
});

describe("Draft transitions", () => {
  it("DRAFT → PENDING_APPROVAL → APPROVED → USED", () => {
    expect(() => assertDraftTransition("DRAFT", "PENDING_APPROVAL")).not.toThrow();
    expect(() => assertDraftTransition("PENDING_APPROVAL", "APPROVED")).not.toThrow();
    expect(() => assertDraftTransition("APPROVED", "USED")).not.toThrow();
  });
  it("APPROVED → DRAFT cấm", () => expect(() => assertDraftTransition("APPROVED", "DRAFT")).toThrow("Không thể chuyển"));
  it("REJECTED → DRAFT cho phép sửa lại", () => expect(() => assertDraftTransition("REJECTED", "DRAFT")).not.toThrow());
  it("USED là terminal", () => expect(() => assertDraftTransition("USED", "DRAFT")).toThrow("Không thể chuyển"));
});

describe("severity change", () => {
  it("đổi khác mức → cho phép (ghi audit)", () => {
    expect(canChangeSeverity("P2", "P1")).toBe(true);
    expect(canChangeSeverity("P2", "P2")).toBe(false);
  });
});
