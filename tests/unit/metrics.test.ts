import { describe, it, expect } from "vitest";
import {
  messageVolume,
  messageVelocity,
  severityDistribution,
  detectionTime,
  acknowledgeTime,
  resolutionTime,
  topicShare,
  platformShare,
} from "@/lib/crisis/metrics";

const min = (n: number) => new Date(Date.now() - n * 60_000);

describe("message metrics", () => {
  it("volume rỗng → not_enough_data", () => {
    expect(messageVolume([])).toEqual({ value: null, note: "not_enough_data" });
  });
  it("volume đếm đúng", () => {
    expect(messageVolume([{ createdAt: min(1) }, { createdAt: min(2) }]).value).toBe(2);
  });
  it("velocity cần ≥2 message trong window", () => {
    expect(messageVelocity([{ createdAt: min(1) }]).note).toBe("not_enough_data");
    const v = messageVelocity([{ createdAt: min(1) }, { createdAt: min(2) }, { createdAt: min(3) }]);
    expect(v.value).toBeGreaterThan(0);
  });
});

describe("distributions", () => {
  it("severity distribution đếm đúng", () => {
    const d = severityDistribution([{ priority: "P1" }, { priority: "P1" }, { priority: "P3" }]);
    expect(d).toMatchObject({ P1: 2, P3: 1, P0: 0, P2: 0 });
  });
});

describe("timing metrics", () => {
  it("detection time từ event start đến alert đầu", () => {
    const start = min(10);
    // alert đầu tiên = min(9) → cách start 1 phút = 60s
    const d = detectionTime([{ createdAt: min(7) }, { createdAt: min(9) }], start);
    expect(d.value).toBe(60);
  });
  it("detection không có event start → not_enough_data", () => {
    expect(detectionTime([{ createdAt: new Date() }], null).note).toBe("not_enough_data");
  });
  it("ack time trung bình", () => {
    const created = min(10);
    const a = acknowledgeTime([
      { createdAt: created, acknowledgedAt: new Date(created.getTime() + 60_000) },
      { createdAt: created, acknowledgedAt: new Date(created.getTime() + 180_000) },
    ]);
    expect(a.value).toBe(120);
  });
  it("ack chưa có ai ack → not_enough_data", () => {
    expect(acknowledgeTime([{ createdAt: min(1), acknowledgedAt: null }]).note).toBe("not_enough_data");
  });
  it("resolution time MTTR", () => {
    const created = min(30);
    const r = resolutionTime([{ createdAt: created, resolvedAt: new Date(created.getTime() + 600_000) }]);
    expect(r.value).toBe(600);
  });
});

describe("shares", () => {
  it("topic share xếp giảm dần, đúng %", () => {
    const msgs = [
      { topic: "delivery" }, { topic: "delivery" }, { topic: "delivery" },
      { topic: "pricing" }, { topic: "pricing" },
      { topic: "other" },
    ];
    const share = topicShare(msgs);
    expect(share[0]).toEqual({ topic: "delivery", count: 3, share: 50 });
    expect(share[1].share).toBe(33);
  });
  it("platform share rỗng → []", () => {
    expect(platformShare([])).toEqual([]);
  });
});
