import { describe, it, expect } from "vitest";
import { computePriority, rank } from "@/lib/crisis/priority";

describe("computePriority", () => {
  it("risk none, mọi chỉ số thấp → P3", () => {
    expect(computePriority({ riskType: "none", velocity: 1, evidenceCount: 1, sentimentNegativeRatio: 0 })).toBe("P3");
  });

  it("product_claim đơn lẻ với negative ratio cao → P2", () => {
    const p = computePriority({ riskType: "product_claim", velocity: 2, evidenceCount: 2, sentimentNegativeRatio: 0.8 });
    expect(rank(p)).toBeLessThanOrEqual(rank("P2"));
  });

  it("delivery burst velocity cao + negative → P1", () => {
    const p = computePriority({ riskType: "delivery", velocity: 20, evidenceCount: 8, sentimentNegativeRatio: 1 });
    expect(["P0", "P1"]).toContain(p);
  });

  it("claim nhiều bằng chứng + velocity cực cao → P0", () => {
    const p = computePriority({ riskType: "product_claim", velocity: 40, evidenceCount: 12, sentimentNegativeRatio: 0.9 });
    expect(p).toBe("P0");
  });

  it("policy P1 đè priority thấp hơn", () => {
    const p = computePriority({ riskType: "spam", velocity: 1, evidenceCount: 1, sentimentNegativeRatio: 0, policyPriority: "P1" });
    expect(p).toBe("P1");
  });

  it("policy không bao giờ HẠ priority", () => {
    const p = computePriority({ riskType: "product_claim", velocity: 40, evidenceCount: 12, sentimentNegativeRatio: 0.9, policyPriority: "P3" });
    expect(p).toBe("P0");
  });
});
