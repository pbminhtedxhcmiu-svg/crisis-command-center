// Template render — pure functions, test độc lập
export type TemplateVars = Record<string, string>;

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v !== undefined ? v : match; // thiếu biến → giữ nguyên để thấy rõ
  });
}

export function extractVariables(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\{(\w+)\}/g)) out.add(m[1]);
  return [...out];
}

export function missingVariables(body: string, vars: TemplateVars): string[] {
  return extractVariables(body).filter((k) => !(k in vars));
}

// Claim cấm: nếu body chứa bất kỳ banned claim → chặn gửi duyệt tự động, bắt buộc legal
export function findBannedClaims(body: string, bannedClaims: string[]): string[] {
  const lower = body.toLowerCase();
  return bannedClaims.filter((claim) => lower.includes(claim.toLowerCase()));
}
