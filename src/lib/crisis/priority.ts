import type { Priority, RiskType } from "@/lib/constants";

// Priority calculation — pure function, dùng chung backend + UI hint
// AI/rule chỉ ĐỀ XUẤT priority; mọi P0/P1 bắt buộc có con người acknowledge/approve.
export type PriorityInput = {
  riskType: RiskType;
  velocity: number; // messages/phút trong cửa sổ
  evidenceCount: number;
  sentimentNegativeRatio: number; // 0..1
  policyPriority?: Priority | null; // từ PolicyRule match
};

const RISK_BASE: Record<RiskType, number> = {
  none: 0,
  praise: 0,
  spam: 1,
  pricing: 1,
  shipping: 2,
  delivery: 3,
  product_claim: 5,
  host_statement: 6, // phát ngôn host/KOL xúc phạm/cam kết sai — rủi ro niềm tin cao nhất
  volume_spike: 4,
} as Record<RiskType, number>;

export function computePriority(input: PriorityInput): Priority {
  let score = RISK_BASE[input.riskType] ?? 0;
  if (input.velocity >= 30) score += 3;
  else if (input.velocity >= 15) score += 2;
  else if (input.velocity >= 6) score += 1;
  if (input.evidenceCount >= 10) score += 2;
  else if (input.evidenceCount >= 4) score += 1;
  if (input.sentimentNegativeRatio >= 0.5) score += 2;
  else if (input.sentimentNegativeRatio >= 0.25) score += 1;

  let priority: Priority;
  if (score >= 9) priority = "P0";
  else if (score >= 6) priority = "P1";
  else if (score >= 3) priority = "P2";
  else priority = "P3";

  // Policy rule có thể ĐÈ priority (chỉ nâng, không hạ — an toàn hơn)
  if (input.policyPriority && rank(input.policyPriority) < rank(priority)) {
    priority = input.policyPriority;
  }
  return priority;
}

export function rank(p: Priority): number {
  return ["P0", "P1", "P2", "P3"].indexOf(p);
}
