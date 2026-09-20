import type { RiskType, Topic, Platform } from "@/lib/constants";
import type { ProductCategory } from "@/lib/constants";
import { categoryMeta } from "@/lib/crisis/categories";

// ===== Interface chuẩn — sau này thay bằng AI model, React không bao giờ gọi trực tiếp =====
export type MessageInput = {
  externalId: string;
  platform: Platform;
  rawText: string;
  language?: string;
  authorName: string;
  category?: ProductCategory | string; // ngành hàng của event — mở rộng claim keywords theo ngành
  engagement?: { likes?: number; replies?: number; shares?: number };
};

export type ClassificationResult = {
  topic: Topic;
  riskType: RiskType;
  sentiment: "negative" | "neutral" | "positive";
};

export interface SignalClassifier {
  classify(input: MessageInput): Promise<ClassificationResult>;
}

// ===== Rule-based implementation =====
type Rule = { topic: Topic; riskType: RiskType; keywords: string[]; sentiment?: "negative" | "neutral" | "positive" };

// Keywords gốc chung mọi ngành. Với product_claim, classifier CỘNG thêm
// claimDoubts theo ngành hàng của event (xem classifyMany) để bắt nghi vấn đặc thù.
const DEFAULT_RULES: Rule[] = [
  {
    topic: "pricing",
    riskType: "pricing",
    keywords: ["giá", "bao nhiêu", "price", "cost", "giá tiền", "phí"],
    sentiment: "neutral",
  },
  {
    topic: "shipping",
    riskType: "shipping",
    keywords: ["vận chuyển", "ship", "giao hàng bao giờ", "freight", "phí ship", "khi nào nhận"],
    sentiment: "neutral",
  },
  {
    topic: "delivery",
    riskType: "delivery",
    keywords: ["chưa nhận", "đã giao", "giao trễ", "lost", "thất lạc", "hỏng", "sai hàng", "đổi trả", "trả hàng"],
    sentiment: "negative",
  },
  {
    // Rủi ro phát ngôn host/KOL ('vạ mồm'): người xem trích dẫn/lên án lời nói xúc phạm,
    // cam kết sai sự thật, quảng cáo quá sự thật của người bán trong live.
    // Đứng TRƯỚC product_claim vì từ khóa đặc thù hơn ('cam kết sai' chứa 'cam kết').
    topic: "product_claim",
    riskType: "host_statement",
    keywords: [
      "quảng cáo quá sự thật",
      "nói xấu khách",
      "chê khách",
      "xúc phạm khách",
      "vạ mồm",
      "miệng méo",
      "nghèo mà đòi",
      "cam kết sai",
      "nói sai",
      "hứa suông",
      "nói quá",
      "host xúc phạm",
      "quang linh",
      "thái độ với khách",
    ],
    sentiment: "negative",
  },
  {
    topic: "product_claim",
    riskType: "product_claim",
    // Tố cáo hàng giả/hàng nhái — cốt lõi playbook pb_counterfeit (ngưỡng burst thấp
    // vì bằng chứng vật lý trong tay khách → lan truyền nhanh hơn mọi crisis khác)
    keywords: [
      "thật không", "lừa đảo", "fake", "hàng giả", "chứng nhận", "kiểm định", "cam kết", "haram",
      "hàng nhái", "tem giả", "khác hình", "xâm phạm thương hiệu", "giả mạo", "hàng fake", "không chính hãng",
    ],
    sentiment: "negative",
  },
  {
    topic: "spam",
    riskType: "spam",
    keywords: ["click link", "inbox vui lòng", "kiếm tiền", "http://", "https://bit"],
    sentiment: "neutral",
  },
  {
    topic: "praise",
    riskType: "none",
    keywords: ["tuyệt", "yêu", "hay quá", "đẹp", "chất lượng", "ủng hộ", "good", "love"],
    sentiment: "positive",
  },
];

export class RuleBasedClassifier implements SignalClassifier {
  constructor(private rules: Rule[] = DEFAULT_RULES) {}

  async classify(input: MessageInput): Promise<ClassificationResult> {
    // Ngành hàng của event — mặc định "other" nếu caller không truyền (backward compatible)
    const meta = categoryMeta(input.category);
    const text = input.rawText.toLowerCase();
    // Thứ tự ưu tiên: host_statement > claim > delivery > spam > shipping > pricing > praise
    // claimDoubts theo ngành CHỈ merge vào rule product_claim (riskType) — không merge vào host_statement
    for (const rule of this.rules) {
      const keywords =
        rule.riskType === "product_claim" ? [...rule.keywords, ...meta.claimDoubts] : rule.keywords;
      if (keywords.some((k) => text.includes(k))) {
        return {
          topic: rule.topic,
          riskType: rule.riskType,
          sentiment: rule.sentiment ?? "neutral",
        };
      }
    }
    return { topic: "other", riskType: "none", sentiment: "neutral" };
  }
}

// Dedupe key: hash nền tảng+text chuẩn hoá — dùng cho spam/duplicate detection
export function dedupeKey(platform: Platform, rawText: string, authorName: string): string {
  const norm = rawText.toLowerCase().replace(/\s+/g, " ").trim();
  return `${platform}:${authorName.toLowerCase()}:${norm}`.slice(0, 180);
}

// Topic grouping key: cùng chủ đề trong window ngắn → gộp signal
export function topicGroupKey(eventId: string, topic: Topic, bucketMs: number, at: Date): string {
  const bucket = Math.floor(at.getTime() / bucketMs);
  return `${eventId}:${topic}:${bucket}`;
}
