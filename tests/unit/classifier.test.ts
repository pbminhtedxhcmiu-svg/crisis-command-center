import { describe, it, expect } from "vitest";
import { RuleBasedClassifier, dedupeKey, topicGroupKey } from "@/lib/crisis/classifier";

const cls = new RuleBasedClassifier();

describe("RuleBasedClassifier", () => {
  it("phân loại hỏi giá → pricing/neutral", async () => {
    const r = await cls.classify({ externalId: "1", platform: "facebook", rawText: "Sản phẩm giá bao nhiêu ạ?", authorName: "A" });
    expect(r.topic).toBe("pricing");
    expect(r.riskType).toBe("pricing");
    expect(r.sentiment).toBe("neutral");
  });

  it("phân loại khiếu nại giao hàng → delivery/negative", async () => {
    const r = await cls.classify({ externalId: "2", platform: "tiktok", rawText: "Đặt 2 tuần rồi chưa nhận được hàng", authorName: "B" });
    expect(r.topic).toBe("delivery");
    expect(r.riskType).toBe("delivery");
    expect(r.sentiment).toBe("negative");
  });

  it("phân loại nghi ngờ claim → product_claim/negative", async () => {
    const r = await cls.classify({ externalId: "3", platform: "shopee", rawText: "Serum này có chứng nhận kiểm định không?", authorName: "C" });
    expect(r.topic).toBe("product_claim");
    expect(r.riskType).toBe("product_claim");
  });

  it("phân loại spam link", async () => {
    const r = await cls.classify({ externalId: "4", platform: "facebook", rawText: "Kiếm tiền online click link ngay http://bit.ly/zzz", authorName: "D" });
    expect(r.topic).toBe("spam");
    expect(r.riskType).toBe("spam");
  });

  it("bình thường → other/none", async () => {
    const r = await cls.classify({ externalId: "5", platform: "facebook", rawText: "Live hôm nay vui quá", authorName: "E" });
    expect(r.topic).toBe("other");
    expect(r.riskType).toBe("none");
  });

  it("khen → praise/positive", async () => {
    const r = await cls.classify({ externalId: "6", platform: "tiktok", rawText: "Sản phẩm tốt lắm, ủng hộ shop", authorName: "F" });
    expect(r.topic).toBe("praise");
    expect(r.sentiment).toBe("positive");
  });

  it("trích phát ngôn 'vạ mồm' của host → host_statement (ưu tiên hơn product_claim)", async () => {
    const r = await cls.classify({ externalId: "7", platform: "facebook", rawText: "Host vừa chê khách 'nghèo mà đòi xịn' là sao vậy shop?", authorName: "G" });
    expect(r.riskType).toBe("host_statement");
    expect(r.sentiment).toBe("negative");
  });

  it("'cam kết sai' → host_statement, không rơi vào product_claim", async () => {
    const r = await cls.classify({ externalId: "8", platform: "tiktok", rawText: "Anh ấy cam kết sai sự thật trong live rồi", authorName: "H" });
    expect(r.riskType).toBe("host_statement");
  });

  it("hỏi kiểm định thông thường vẫn là product_claim", async () => {
    const r = await cls.classify({ externalId: "9", platform: "shopee", rawText: "Sản phẩm có kiểm định Bộ Y tế chưa ạ?", authorName: "I" });
    expect(r.riskType).toBe("product_claim");
  });
});

describe("dedupeKey", () => {
  it("giống nhau dù khác hoa/thường/khoảng trắng", () => {
    const a = dedupeKey("facebook", "Kiếm tiền ONLINE click link", "Minh A.");
    const b = dedupeKey("facebook", "kiếm tiền online   click link", "minh a.");
    expect(a).toBe(b);
  });
  it("khác author → khác key", () => {
    const a = dedupeKey("facebook", "x", "Minh");
    const b = dedupeKey("facebook", "x", "Lan");
    expect(a).not.toBe(b);
  });
});

describe("tố cáo hàng giả / hàng nhái (playbook pb_counterfeit)", () => {
  const classifier = new RuleBasedClassifier();
  const classify = (text: string) =>
    classifier.classify({ externalId: "t", platform: "tiktok", rawText: text, authorName: "a", category: "fashion" });

  it("nhận diện tố cáo hàng nhái / tem giả / khác hình → product_claim", async () => {
    for (const text of [
      "Nhận hàng nhái tem giả, khác hình hoàn toàn",
      "Shop bán hàng fake xâm phạm thương hiệu rồi",
      "Sản phẩm giả mạo, không chính hãng",
      "Đây là hàng fake nhé mọi người",
    ]) {
      const cls = await classify(text);
      expect(cls.riskType).toBe("product_claim");
      expect(cls.sentiment).toBe("negative");
    }
  });
});

describe("topicGroupKey", () => {
  it("cùng bucket thời gian → cùng key", () => {
    const a = topicGroupKey("evt", "delivery", 60_000, new Date("2026-01-01T10:00:30Z"));
    const b = topicGroupKey("evt", "delivery", 60_000, new Date("2026-01-01T10:00:59Z"));
    expect(a).toBe(b);
  });
  it("khác bucket → khác key", () => {
    const a = topicGroupKey("evt", "delivery", 60_000, new Date("2026-01-01T10:00:59Z"));
    const b = topicGroupKey("evt", "delivery", 60_000, new Date("2026-01-01T10:01:01Z"));
    expect(a).not.toBe(b);
  });
});
