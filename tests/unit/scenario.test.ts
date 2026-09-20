import { describe, it, expect } from "vitest";
import {
  SCENARIOS,
  SCENARIO_LIST,
  messagesForTick,
  currentPhase,
  phasesFor,
  authorForIndex,
  type ScenarioId,
} from "@/lib/crisis/scenario";
import { RuleBasedClassifier } from "@/lib/crisis/classifier";
import { SIM_MESSAGES_PER_TICK } from "@/lib/constants";

const IDS: ScenarioId[] = ["o_sau_rieng", "crisis_live", "classic_mix"];

describe("scenario metadata", () => {
  it("đủ 3 kịch bản, mỗi cái có meta đầy đủ", () => {
    expect(SCENARIO_LIST).toHaveLength(3);
    for (const s of SCENARIO_LIST) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.productHint).toBeTruthy();
      expect(s.platforms.length).toBeGreaterThan(0);
    }
  });
});

describe("messagesForTick — tính TẤT ĐỊNH (không còn ngẫu nhiên)", () => {
  it.each(IDS)("cùng tick → cùng kết quả (%s)", (id) => {
    for (let tick = 1; tick <= 24; tick++) {
      const a = messagesForTick(tick, id);
      const b = messagesForTick(tick, id);
      expect(a).toEqual(b);
    }
  });

  it.each(IDS)("tick khác nhau → khác nhau (%s)", (id) => {
    const t1 = messagesForTick(1, id);
    const t13 = messagesForTick(13, id);
    expect(t1).not.toEqual(t13);
  });

  it("đúng số message mỗi tick (SIM_MESSAGES_PER_TICK)", () => {
    for (const id of IDS) {
      for (let tick = 1; tick <= 24; tick++) {
        const msgs = messagesForTick(tick, id);
        expect(msgs).toHaveLength(SIM_MESSAGES_PER_TICK);
        for (const m of msgs) {
          expect(m.text).toBeTruthy();
          expect(m.author).toBeTruthy();
          expect(m.platform).toBeTruthy();
        }
      }
    }
  });

  it("author lặp theo vai diễn (tất định)", () => {
    expect(authorForIndex(0)).toBe(authorForIndex(0));
    expect(authorForIndex(1)).not.toBe(authorForIndex(2));
  });

  it("dùng productHint override khi truyền vào", () => {
    const custom = messagesForTick(1, "o_sau_rieng", "măng cụt Lái Thiêu");
    const texts = custom.map((m) => m.text).join(" ");
    // tick 1 của o_sau_rieng có text chứa productHint
    expect(texts).toContain("măng cụt Lái Thiêu");
  });
});

describe("phases — timeline đầy đủ, không lỗ hổng", () => {
  it.each(IDS)("phủ liên tục từ tick 1 đến tick cuối (%s)", (id) => {
    const phases = phasesFor(id);
    const last = phases[phases.length - 1]!;
    expect(phases[0]!.fromTick).toBe(1);
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.fromTick).toBeLessThanOrEqual(phases[i - 1]!.toTick + 1);
    }
    expect(last.toTick).toBeGreaterThanOrEqual(20);
    for (const p of phases) {
      expect(p.label).toBeTruthy();
      expect(p.hint).toBeTruthy();
    }
  });

  it("currentPhase trả đúng phase theo tick", () => {
    const p1 = currentPhase(2, "o_sau_rieng");
    expect(p1?.label).toBe("Khởi động phiên");
    const p3 = currentPhase(13, "o_sau_rieng");
    expect(p3?.label).toContain("VẠ MỘM");
    expect(currentPhase(999, "o_sau_rieng")).toBeNull();
  });
});

describe("kịch bản sinh alert đúng phase (qua classifier thật)", () => {
  const classifier = new RuleBasedClassifier();
  const classify = (text: string) =>
    classifier.classify({ externalId: "t", platform: "tiktok", rawText: text, authorName: "a", category: "food" });

  it("o_sau_rieng: tick ở phase 'vạ mồm' (12–15) có ≥1 text classify thành host_statement", async () => {
    for (let tick = 12; tick <= 15; tick++) {
      const msgs = messagesForTick(tick, "o_sau_rieng");
      let hostCount = 0;
      for (const m of msgs) {
        const cls = await classify(m.text);
        if (cls.riskType === "host_statement") hostCount++;
      }
      expect(hostCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("o_sau_rieng: tick 5–8 có khiếu nại giao hàng (delivery) — đủ ngưỡng burst ≥3/tick", async () => {
    for (let tick = 5; tick <= 8; tick++) {
      const msgs = messagesForTick(tick, "o_sau_rieng");
      let delivery = 0;
      for (const m of msgs) {
        const cls = await classify(m.text);
        if (cls.riskType === "delivery") delivery++;
      }
      expect(delivery).toBeGreaterThanOrEqual(3);
    }
  });

  it("o_sau_rieng: tick 9–11 có nghi vấn claim sản phẩm", async () => {
    for (let tick = 9; tick <= 11; tick++) {
      const msgs = messagesForTick(tick, "o_sau_rieng");
      let claims = 0;
      for (const m of msgs) {
        const cls = await classify(m.text);
        if (cls.riskType === "product_claim") claims++;
      }
      expect(claims).toBeGreaterThanOrEqual(1);
    }
  });

  it("o_sau_rieng: tick khởi động (1–4) là bình luận bình thường — không risk khủng hoảng", async () => {
    const CRISIS_RISKS = ["delivery", "product_claim", "host_statement", "spam"];
    for (let tick = 1; tick <= 4; tick++) {
      const msgs = messagesForTick(tick, "o_sau_rieng");
      for (const m of msgs) {
        const cls = await classify(m.text);
        // hỏi giá/mã giảm giá được phân loại topic pricing — KHÔNG phải risk khủng hoảng
        expect(CRISIS_RISKS).not.toContain(cls.riskType);
      }
    }
  });

  it("crisis_live: phase khủng hoảng (6–15) mỗi tick đều có host_statement", async () => {
    for (let tick = 6; tick <= 15; tick++) {
      const msgs = messagesForTick(tick, "crisis_live");
      let hostCount = 0;
      for (const m of msgs) {
        const cls = await classify(m.text);
        if (cls.riskType === "host_statement") hostCount++;
      }
      expect(hostCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("classic_mix: có tick sinh spam lặp lại (dedupe)", async () => {
    let sawSpam = false;
    for (let tick = 1; tick <= 20; tick++) {
      for (const m of messagesForTick(tick, "classic_mix")) {
        const cls = await classify(m.text);
        if (cls.riskType === "spam") sawSpam = true;
      }
    }
    expect(sawSpam).toBe(true);
  });

  it("kịch bản o_sau_rieng có kể chuyện theo trình tự: bình thường → vạ mồm → hạ nhiệt", () => {
    // Text tick 1 (bình thường) không chứa từ khóa risk
    const early = messagesForTick(1, "o_sau_rieng").map((m) => m.text).join(" ");
    expect(early).not.toMatch(/vạ mồm|chê khách|xúc phạm/i);
    // Text tick 13 (cao trào) có trích lời host
    const peak = messagesForTick(13, "o_sau_rieng").map((m) => m.text).join(" ");
    expect(peak).toMatch(/host|khách mời/i);
    // Text tick 23 (hạ nhiệt) là tích cực
    const cool = messagesForTick(23, "o_sau_rieng").map((m) => m.text).join(" ");
    expect(cool).toMatch(/deal|tuyệt|ủng hộ|tốt|đẹp|đóng gói/i);
  });

  it("mọi kịch bản đều đăng ký trong SCENARIOS với scenes() trả về dữ liệu", () => {
    for (const id of IDS) {
      const scenes = SCENARIOS[id].scenes(SCENARIOS[id].productHint);
      expect(scenes.length).toBeGreaterThan(0);
      for (const s of scenes) {
        expect(s.texts.length).toBeGreaterThan(0);
        expect(s.fromTick).toBeLessThanOrEqual(s.toTick);
      }
    }
  });
});
