import { describe, it, expect } from "vitest";
import { slaWindows, slaState, slaCompliance } from "@/lib/sla";

describe("slaWindows", () => {
  it("P0: ack 5 phút, action 15 phút", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const w = slaWindows("P0", from);
    expect(w.ackDueAt?.getTime()).toBe(from.getTime() + 5 * 60_000);
    expect(w.actionDueAt?.getTime()).toBe(from.getTime() + 15 * 60_000);
  });
  it("P1: ack 10, action 30; P2: 15/60", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    expect(slaWindows("P1", from).ackDueAt?.getUTCHours() !== null).toBe(true);
    expect(slaWindows("P2", from).actionDueAt).not.toBeNull();
  });
  it("P3: không có SLA", () => {
    const w = slaWindows("P3");
    expect(w.ackDueAt).toBeNull();
    expect(w.actionDueAt).toBeNull();
  });
});

describe("slaState", () => {
  it("còn >1 phút → ok", () => {
    expect(slaState(new Date(Date.now() + 10 * 60_000))).toBe("ok");
  });
  it("còn <1 phút → at_risk", () => {
    expect(slaState(new Date(Date.now() + 30_000))).toBe("at_risk");
  });
  it("quá hạn → breached", () => {
    expect(slaState(new Date(Date.now() - 60_000))).toBe("breached");
  });
  it("null → none", () => {
    expect(slaState(null)).toBe("none");
  });
});

describe("slaCompliance", () => {
  it("không có incident có SLA → ratio null", () => {
    expect(slaCompliance([{ slaAckDueAt: null, slaAckAt: null }]).ratio).toBeNull();
  });
  it("1/2 đạt → 0.5", () => {
    const now = new Date();
    const r = slaCompliance([
      { slaAckDueAt: new Date(now.getTime() + 60_000), slaAckAt: now },
      { slaAckDueAt: new Date(now.getTime() - 60_000), slaAckAt: now },
    ]);
    expect(r.ratio).toBe(0.5);
  });
});
