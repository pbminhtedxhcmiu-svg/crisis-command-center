import { describe, it, expect } from "vitest";
import { PRODUCT_CATEGORY_META, categoryMeta } from "@/lib/crisis/categories";
import { PRODUCT_CATEGORIES, DEFAULT_PRODUCT_CATEGORY } from "@/lib/constants";
import { RuleBasedClassifier } from "@/lib/crisis/classifier";

describe("PRODUCT_CATEGORY_META", () => {
  it("đủ meta cho mọi category trong constants (không thiếu/không thừa)", () => {
    expect(Object.keys(PRODUCT_CATEGORY_META).sort()).toEqual([...PRODUCT_CATEGORIES].sort());
  });

  it("mỗi ngành đều có label + claimDoubts + authority", () => {
    for (const c of PRODUCT_CATEGORIES) {
      const meta = PRODUCT_CATEGORY_META[c];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.claimDoubts.length).toBeGreaterThan(0);
      expect(meta.claimBenefits.length).toBeGreaterThan(0);
      expect(meta.authority.length).toBeGreaterThan(0);
    }
  });

  it("category lạ/undefined → fallback 'other'", () => {
    expect(categoryMeta("khong_ton_tai")).toBe(PRODUCT_CATEGORY_META.other);
    expect(categoryMeta(null)).toBe(PRODUCT_CATEGORY_META[DEFAULT_PRODUCT_CATEGORY]);
  });
});

describe("classifier theo ngành hàng", () => {
  const cls = new RuleBasedClassifier();

  it("mỹ phẩm: 'trộn corticoid' → product_claim (từ claimDoubts ngành)", async () => {
    const r = await cls.classify({
      externalId: "c1", platform: "facebook", authorName: "A",
      rawText: "Kem này nghe nói trộn corticoid thật không?", category: "cosmetics",
    });
    expect(r.topic).toBe("product_claim");
    expect(r.riskType).toBe("product_claim");
  });

  it("điện tử: 'nổ pin' → product_claim; cùng text không ngành → other", async () => {
    const input = {
      externalId: "c2", platform: "tiktok" as const, authorName: "B",
      rawText: "Pin sạc này nghe nói nổ pin, có đúng không?",
    };
    const withCat = await cls.classify({ ...input, category: "electronics" });
    expect(withCat.riskType).toBe("product_claim");
    const noCat = await cls.classify(input);
    expect(noCat.riskType).toBe("none");
  });

  it("F&B: 'hết date' → product_claim", async () => {
    const r = await cls.classify({
      externalId: "c3", platform: "shopee", authorName: "C",
      rawText: "Hàng này có bị hết date không vậy shop?", category: "food",
    });
    expect(r.topic).toBe("product_claim");
  });

  it("hành vi cũ không ngành vẫn giữ nguyên (backward compatible)", async () => {
    const r = await cls.classify({
      externalId: "c4", platform: "facebook", authorName: "D",
      rawText: "Sản phẩm giá bao nhiêu ạ?",
    });
    expect(r.topic).toBe("pricing");
    expect(r.riskType).toBe("pricing");
  });
});
