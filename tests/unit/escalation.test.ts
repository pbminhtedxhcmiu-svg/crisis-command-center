import { describe, it, expect } from "vitest";
import { computeCrisisLevel, levelReason, levelDef, maxPriorityAlert, CRISIS_LEVELS } from "@/lib/crisis/escalation";

const base = {
  eventStatus: "LIVE",
  negativeMessagesLast5m: 0,
  hasOpenP0Alert: false,
  hasOpenP1Alert: false,
  openIncidents: 0,
  hostStatementAlerts: 0,
  viewerDropPct: null,
};

describe("computeCrisisLevel", () => {
  it("event không LIVE → level 0 bất kể tín hiệu", () => {
    expect(computeCrisisLevel({ ...base, eventStatus: "ENDED", hasOpenP0Alert: true })).toBe(0);
  });

  it("bình thường → level 0", () => {
    expect(computeCrisisLevel(base)).toBe(0);
  });

  it("vài comment rủi ro → level 1 (Minor)", () => {
    expect(computeCrisisLevel({ ...base, negativeMessagesLast5m: 4 })).toBe(1);
  });

  it("alert P1 mở → level 2 (Moderate — kích hoạt CRT)", () => {
    expect(computeCrisisLevel({ ...base, hasOpenP1Alert: true })).toBe(2);
  });

  it("vạ mồm (host_statement) dù 1 alert → level 2 ngay — bài học case O sầu riêng", () => {
    expect(computeCrisisLevel({ ...base, hostStatementAlerts: 1 })).toBe(2);
  });

  it("incident mở → tối thiểu level 2", () => {
    expect(computeCrisisLevel({ ...base, openIncidents: 1 })).toBe(2);
  });

  it("P0 mở → level 3 (Severe — cắt sóng/statement)", () => {
    expect(computeCrisisLevel({ ...base, hasOpenP0Alert: true })).toBe(3);
  });

  it("P0 + vạ mồm + incident → level 4 (Critical)", () => {
    expect(
      computeCrisisLevel({ ...base, hasOpenP0Alert: true, hostStatementAlerts: 2, openIncidents: 1 }),
    ).toBe(4);
  });

  it("ưu tiên mức CAO NHẤT thoả — không bao giờ hạ cấp vì tín hiệu nhẹ hơn", () => {
    expect(
      computeCrisisLevel({ ...base, negativeMessagesLast5m: 100, hasOpenP1Alert: true, openIncidents: 2 }),
    ).toBe(2);
  });
});

describe("levelReason + levelDef", () => {
  it("reason liệt kê đủ tín hiệu", () => {
    const reason = levelReason({ ...base, hasOpenP1Alert: true, openIncidents: 1 });
    expect(reason).toContain("P1");
    expect(reason).toContain("incident");
  });

  it("levelDef trả null ở level 0 và đủ 4 cấp ở 1–4", () => {
    expect(levelDef(0)).toBeNull();
    for (const lv of [1, 2, 3, 4] as const) {
      expect(levelDef(lv)?.actions.length).toBeGreaterThan(0);
      expect(CRISIS_LEVELS[lv].dontDo.length).toBeGreaterThan(0);
      expect(CRISIS_LEVELS[lv].hostScript.length).toBeGreaterThan(0);
    }
  });
});

describe("maxPriorityAlert", () => {
  it("chỉ tính alert đang mở", () => {
    expect(maxPriorityAlert([{ priority: "P0", status: "CONVERTED" }, { priority: "P2", status: "OPEN" }])).toBe("P2");
    expect(maxPriorityAlert([{ priority: "P1", status: "DISMISSED" }])).toBeNull();
    expect(maxPriorityAlert([{ priority: "P3", status: "OPEN" }, { priority: "P1", status: "SNOOZED" }])).toBe("P1");
  });
});
