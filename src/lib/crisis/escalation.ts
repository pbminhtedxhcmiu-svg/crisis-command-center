import type { Priority } from "@/lib/constants";

// ===== Escalation matrix 4 mức độ khủng hoảng livestream =====
// Nguồn: Crisis_Playbook_O_Huyen_Sau_Rieng.docx (v1.0, framework 4 mức độ) +
// case O Huyền sầu riêng 07/07/2024 & O sầu riêng Đắk Lắk 10/2024.
// Mọi kịch bản là DỮ LIỆU tĩnh (pure) — Command Center render theo cấp độ hiện tại
// được tính từ alerts/incidents đang mở. Không thao tác DB ở module này.

export type CrisisLevel = 0 | 1 | 2 | 3 | 4;

export type EscalationAction = {
  role: string; // MOD | HOST | PRODUCER | CRT | BRAND_MANAGER | LEGAL | CEO ...
  action: string;
  deadline: string; // thời hạn thực hiện tính từ lúc cấp độ xác nhận
};

export type CrisisLevelDef = {
  level: CrisisLevel;
  code: "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL";
  label: string;
  color: string; // badge class
  signals: string[];
  actions: EscalationAction[];
  hostScript: string; // template phát ngôn host đọc ngay trong live
  dontDo: string[]; // việc KHÔNG được làm ở cấp độ này
};

export const CRISIS_LEVELS: Record<1 | 2 | 3 | 4, CrisisLevelDef> = {
  1: {
    level: 1,
    code: "MINOR",
    label: "Nhẹ — xử lý tại chỗ",
    color: "badge badge-p3",
    signals: [
      "< 20 comment tiêu cực liên tiếp trong 5 phút",
      "Viewer drop < 5%",
      "Chưa có clip/screenshot phát tán ngoài nền tảng",
    ],
    actions: [
      { role: "MOD", action: "Ẩn/xoá comment tiêu cực theo cụm từ khóa đã thiết lập; pin comment chuyển hướng", deadline: "2–5 phút" },
      { role: "MOD", action: "Tín hiệu nội bộ cho Host: 'Level 1 — minor tension, suggest redirect'", deadline: "ngay" },
      { role: "HOST", action: "Chuyển hướng tự nhiên về sản phẩm; đính chính nhẹ nếu là hiểu lầm — KHÔNG đề cập controversy", deadline: "2–5 phút" },
      { role: "PRODUCER", action: "Nhắc nhẹ guest/đại diện brand qua earpiece; giảm mic time của người đang gây vấn đề", deadline: "5 phút" },
    ],
    hostScript:
      "Cảm ơn các bạn đã quan tâm! Hôm nay chúng ta còn rất nhiều sản phẩm chất lượng cần khám phá — mình mời [Tên đại diện] giới thiệu quy trình sản phẩm nhé!",
    dontDo: ["Không drama hoá hiểu lầm", "Không đọc to bình luận tiêu cực trước khán giả"],
  },
  2: {
    level: 2,
    code: "MODERATE",
    label: "Trung bình — kích hoạt CRT",
    color: "badge badge-p2",
    signals: [
      "> 50 comment tiêu cực/phút hoặc alert P1 đang mở",
      "Clip/screenshot bắt đầu phát tán sang group, fanpage nhỏ",
      "Viewer drop > 10–15% trong 10 phút",
      "Có kêu gọi 'hủy đơn' / 'tẩy chay' trong comment",
    ],
    actions: [
      { role: "CRT", action: "Kích hoạt Crisis Response Team (Host, MOD Lead, Producer, Social Media, Brand Rep) theo dõi sát sao", deadline: "5–10 phút" },
      { role: "HOST", action: "Lên tiếng trực tiếp theo pre-approved script; xin lỗi nếu lỗi thuộc về kênh; chuyển hướng nội dung", deadline: "5–10 phút" },
      { role: "PRODUCER", action: "Bật slow-mode comment (delay 30s); tăng bộ lọc từ khóa cấm trên nền tảng phát", deadline: "5 phút" },
      { role: "PRODUCER", action: "Cắt 'emotional redirect content pack' (câu chuyện nông dân/quy trình sản phẩm) vào Live", deadline: "10 phút" },
      { role: "BRAND_MANAGER", action: "Brief riêng người gây sự cố: 'giảm xuất hiện 15 phút'; soạn draft statement giữ sẵn chờ Level 3", deadline: "15 phút" },
      { role: "SOCIAL_MEDIA", action: "Theo dõi sentiment đa nền tảng; chụp lưu bằng chứng clip đang lan", deadline: "30 phút" },
    ],
    hostScript:
      "Mọi người ơi — hôm nay có chút hiểu lầm nho nhỏ. Mình muốn nói rõ: [đính chính cụ thể]. Chúng mình ở đây vì [câu chuyện thương hiệu]. Cảm ơn mọi người đã tiếp tục đồng hành!",
    dontDo: ["Không để người gây sự cố tiếp tục nói dài", "Không đăng statement chính thức vội khi chưa align CRT"],
  },
  3: {
    level: 3,
    code: "SEVERE",
    label: "Nghiêm trọng — cắt sóng & thông cáo",
    color: "badge badge-p1",
    signals: [
      "Clip phát tán trên > 3 nền tảng (TikTok, Facebook, Threads, báo mạng)",
      "Hashtag tẩy chay / hủy đơn trending, sentiment tiêu cực",
      "Trang tin tức bắt đầu đưa tin",
      "Alert P0 đang mở hoặc incident khủng hoảng phát ngôn đã tạo",
    ],
    actions: [
      { role: "PRODUCER", action: "XEM XÉT CẮT SÓNG ngay — nếu tình huống không thể cứu vãn trong 5 phút tới", deadline: "5 phút" },
      { role: "BRAND_MANAGER", action: "Ẩn sản phẩm trên sàn (TikTok Shop/Shopee) tạm thời — tránh đơn mới trong khủng hoảng", deadline: "15 phút" },
      { role: "CRT", action: "Họp khẩn CRT + Leadership: chốt 1 người phát ngôn duy nhất + 1 statement duy nhất", deadline: "15–30 phút" },
      { role: "PR", action: "Đăng statement trong 'khung giờ vàng' (1–2h đầu): xin lỗi người gây sự cố trước, brand statement số liệu sau, KOL chỉ amplifier", deadline: "1–2 giờ" },
      { role: "SOCIAL_MEDIA", action: "Monitor đa nền tảng + trả lời media inquiry theo đúng statement", deadline: "liên tục" },
    ],
    hostScript:
      "[Nếu vẫn phát]: Chúng tôi tạm dừng phiên live để xác minh thông tin. Mọi cập nhật chính thức sẽ được đăng trên kênh của chúng tôi. Xin quý khán giả thông cảm.",
    dontDo: [
      "Không im lặng quá 60 phút — Golden Hour Rule: dù chỉ 'đã biết và đang xử lý'",
      "Không để KOL lên tiếng trước brand statement",
      "Không phản công hay đổ lỗi cho cộng đồng",
    ],
  },
  4: {
    level: 4,
    code: "CRITICAL",
    label: "Khẩn cấp toàn hệ thống",
    color: "badge badge-p0",
    signals: [
      "Cơ quan chức năng (Cục ATTP, Công an, Bộ TT&TT) vào cuộc",
      "Nền tảng cảnh báo/khóa kênh",
      "Tẩy chay có tổ chức toàn quốc, thiệt hại tài chính thực tế (lừa đảo, hàng giả)",
    ],
    actions: [
      { role: "PRODUCER", action: "END STREAM — dừng mọi phát sóng ngay lập tức", deadline: "ngay" },
      { role: "SOCIAL_MEDIA", action: "FREEZE SOCIAL — đóng băng mọi đăng tải trên tất cả kênh", deadline: "ngay" },
      { role: "LEGAL", action: "Liên hệ luật sư (retainer sẵn) trong 30 phút; hợp tác đầy đủ với cơ quan chức năng", deadline: "30 phút" },
      { role: "CEO", action: "Ban lãnh đạo cấp cao trực tiếp chỉ đạo; chốt người phát ngôn duy nhất (CEO/người đại diện pháp lý)", deadline: "30–60 phút" },
      { role: "CEO", action: "Tuyên bố công khai: < 2h đóng băng + cam kết điều tra; < 6h công khai sự thật; < 24h kế hoạch bồi thường", deadline: "2–24 giờ" },
      { role: "CSKH", action: "Hotline tiếp nhận khách hàng bị ảnh hưởng; cập nhật tiến trình mỗi 6 giờ", deadline: "liên tục" },
    ],
    hostScript:
      "[Thông cáo]: Chúng tôi xác nhận đang xử lý sự việc nghiêm trọng. Chúng tôi tạm dừng hoạt động kinh doanh trực tuyến trong thời gian điều tra và cam kết hợp tác hoàn toàn với cơ quan chức năng. Khách hàng liên hệ [hotline] để được hỗ trợ.",
    dontDo: [
      "Không xoá bằng chứng hoặc che giấu thông tin",
      "Không để KOL/đối tác phát ngôn tự do",
      "Không im lặng > 2 giờ",
      "Không tiếp tục bán hàng khi đang bị điều tra",
    ],
  },
};

// ===== Tính cấp độ hiện tại từ dữ liệu runtime của event =====
export type EscalationInput = {
  eventStatus: string;
  negativeMessagesLast5m: number; // messages risk != none trong 5 phút
  hasOpenP0Alert: boolean;
  hasOpenP1Alert: boolean;
  openIncidents: number;
  hostStatementAlerts: number; // alert [host_statement] đang mở — vạ mồm leo thang nhanh
  viewerDropPct?: number | null;
};

// Ưu tiên mức CAO NHẤT thoả — an toàn hơn (thiên về xử lý sớm, học từ case O Huyền
// không ai can thiệp ở Level 1 nên leo thang 1→3 trong 30 phút).
export function computeCrisisLevel(input: EscalationInput): CrisisLevel {
  if (input.eventStatus !== "LIVE") return 0;
  // Level 4: thiên tai pháp lý — hệ thống chỉ gợi ý khi có incident P0 mở + vạ mồm lan;
  // xác nhận Level 4 luôn là quyết định con người (CEO/Legal), không tự nhảy cấp.
  if (input.hasOpenP0Alert && input.hostStatementAlerts > 0 && input.openIncidents > 0) return 4;
  if (input.hasOpenP0Alert) return 3;
  if (input.hostStatementAlerts > 0 || input.hasOpenP1Alert || input.openIncidents > 0) return 2;
  if (input.negativeMessagesLast5m >= 3) return 1;
  return 0;
}

// Mô tả ngắn "tại sao ở cấp độ này" để banner hiển thị
export function levelReason(input: EscalationInput): string {
  const parts: string[] = [];
  if (input.hasOpenP0Alert) parts.push("alert P0 đang mở");
  if (input.hostStatementAlerts > 0) parts.push(`${input.hostStatementAlerts} alert phát ngôn host/KOL (vạ mồm)`);
  if (input.hasOpenP1Alert) parts.push("alert P1 đang mở");
  if (input.openIncidents > 0) parts.push(`${input.openIncidents} incident đang mở`);
  if (input.negativeMessagesLast5m >= 3) parts.push(`${input.negativeMessagesLast5m} bình luận rủi ro/5 phút`);
  return parts.length > 0 ? parts.join(" · ") : "chưa có tín hiệu rủi ro";
}

export function levelDef(level: CrisisLevel): CrisisLevelDef | null {
  return level >= 1 ? CRISIS_LEVELS[level as 1 | 2 | 3 | 4] : null;
}

// Map priority alert → tín hiệu escalation (dùng khi tính từ alerts của /stream)
export function alertIsOpen(a: { status: string }): boolean {
  return a.status === "OPEN" || a.status === "SNOOZED" || a.status === "ACKNOWLEDGED";
}

export function maxPriorityAlert(alerts: Array<{ priority: string; status: string }>): Priority | null {
  const open = alerts.filter(alertIsOpen);
  if (open.some((a) => a.priority === "P0")) return "P0";
  if (open.some((a) => a.priority === "P1")) return "P1";
  if (open.some((a) => a.priority === "P2")) return "P2";
  if (open.some((a) => a.priority === "P3")) return "P3";
  return null;
}
