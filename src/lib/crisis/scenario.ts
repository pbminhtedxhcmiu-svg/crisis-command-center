import { SIM_MESSAGES_PER_TICK } from "@/lib/constants";
import type { Platform } from "@/lib/constants";

// ===== Kịch bản demo CỐ ĐỊNH (scripted) — không còn ngẫu nhiên =====
// Toàn bộ nội dung demo là dữ liệu thuần + hàm thuần (pure): cùng tick → cùng
// message, cùng tác giả, cùng nền tảng. Chạy lại từ đầu cho kết quả giống hệt,
// và unit test được mà không đụng DB.
//
// Kịch bản mặc định tái hiện case "O sầu riêng" (10/2024): phiên live bán sầu
// riêng bình thường → khiếu nại giao hàng → nghi vấn cam kết → khách trích lời
// host "vạ mồm" → lan truyền → áp lực khủng hoảng → xử lý theo playbook → hạ
// nhiệt. Mỗi giai đoạn có label hiển thị ngay trong Command Center.

export type ScenarioId = "o_sau_rieng" | "crisis_live" | "classic_mix";

export type ScenarioMeta = {
  id: ScenarioId;
  name: string;
  description: string;
  productHint: string;
  category: string;
  platforms: Platform[];
};

// Tác giả lặp lại đúng theo "nhân vật" của kịch bản (người khiếu nại, người
// trích lời host, khán giả trung lập...) — demo đọc như câu chuyện thật.
function authorFor(roleIndex: number): string {
  const ROLES = [
    "Chị Hằng (khách cũ)",
    "Anh Tuấn (QLKS)",
    "Mỹ Duyên",
    "wait_fruit_farm",
    "Trần Quốc Huy",
    "Ba Chị Em Review",
    "Lan Anh",
    "daklak_farm88",
    "Khánh Vy",
    "Mẹ bỉm Hòa Bình",
    "Trí (TP.HCM)",
    "người bán sầu riêng",
  ];
  return ROLES[roleIndex % ROLES.length]!;
}

export type Phase = { fromTick: number; toTick: number; label: string; hint: string };

// ---- Kịch bản 1 (mặc định): tái hiện case O sầu riêng 10/2024 ----
// Mỗi dòng = 1 bình luận sẽ xuất hiện ĐÚNG theo thứ tự, 3 bình luận / tick.
// (tick = giây trong demo; tổng ~20 tick ≈ 20 giây nhưng timeline sự kiện
// được ghi chú theo tương đương thời gian thực của case gốc.)
type Scene = { fromTick: number; toTick: number; texts: string[] };

function oSauRiengScenes(productHint: string): Scene[] {
  return [
    // P0 · Khởi động phiên — không khí bán hàng sôi động, mọi thứ bình thường
    {
      fromTick: 1,
      toTick: 4,
      texts: [
        `Sầu riêng ${productHint} hôm nay bao nhiêu 1 kg vậy shop?`,
        "Live chào cả nhà, hôm nay cơm sầu riêng đầy ạ!",
        "Cho em xin mã giảm giá với ạ",
        "Quả Ri6 này trọng lượng bao nhiêugram ạ?",
        "Ship về Hà Nội mấy ngày ạ?",
        "Khứa cứ tự nhiên, hôm nay shop có deal sốc nè",
        "Nghe nói cơm vàng, hạt lép, đúng không shop?",
        "Đặt 2 quả có được giảm không ạ?",
        "Live hôm nay nhiều deal quá ạ",
        "Xin mã giảm giá với ạ",
        "Quy trình đóng gói có đảm bảo không ạ?",
        "Mùa này sầu riêng ngọt lắm mọi người ơi",
      ],
    },
    // P1 · Áp lực vận hành — khiếu nại giao hàng/đơn trễ dồn dập
    {
      fromTick: 5,
      toTick: 8,
      texts: [
        "Đặt tuần trước chưa nhận được hàng, shop ơi",
        "Đơn của tôi giao trễ quá lâu rồi",
        "Hàng nhận được dập nát, cần đổi trả gấp",
        "Shipper giao trễ, không ai trả lời cả",
        "Chưa nhận được hàng mà đơn đã closed là sao?",
        "Giao trễ 10 ngày rồi, khi nào có hàng đây shop?",
        "Đơn thất lạc rồi shop ơi, xử lý giúp em",
        "Trả hàng rồi mà chưa được hoàn tiền",
        "Bản thảo đơn tôi vẫn chưa thấy cập nhật",
        "Khổ quá, đặt quà tặng sinh viên giờ chưa tới",
        "Chưa thấy shop phản hồi đơn 120422 gì đó",
        "Vận đơn của tôi bị treo 4 ngày rồi",
      ],
    },
    // P2 · Nghi vấn cam kết — khách hỏi chứng nhận, đếm ngược đòi bằng chứng
    {
      fromTick: 9,
      toTick: 11,
      texts: [
        "Sầu riêng có chứng nhận kiểm định không vậy?",
        "Nghe nói sầu riêng bị thu hồi vì thuốcBVTV, thật không?",
        "Quảng cáo 'cơm vàng hạt lép' là quảng cáo quá sự thật rồi",
        "Có ai kiểm định chứng nhận của bộ nông nghiệp chưa ạ?",
        "Bạn nào dùng thấy cơm vàng hạt lép chưa? Tôi nghi lắm.",
        "Xin bằng chứng kiểm định đi shop, đừng nói suông",
        "Cam kết bao ăn, bao ngọt có ghi vào đơn không?",
        "Nhà vườn nào cung cấp, có hóa đơn nguồn gốc không?",
        "Kiểm định ở đâu, ai cấp, số biên bản bao nhiêu?",
        "Mua về quả xấu, shop đền kiểu gì đây?",
        "Bao ăn bao ngọt — là cam kết pháp lý hay lời nói?",
        "Nếu quả xấu thì hoàn tiền không shop?",
      ],
    },
    // P3 · VẠ MỘM — khách trích lời host/khách mời chê khách "nghèo mà đòi xịn" (cao trào)
    {
      fromTick: 12,
      toTick: 15,
      texts: [
        "Host vừa chê khách 'nghèo mà đòi xịn' là sao vậy shop?",
        "Anh khách mời cam kết 'không quả nào xấu' là quảng cáo quá sự thật rồi",
        "Ai quay lại đoạn host xúc phạm khách chưa, up lên xem nào",
        "Thái độ với khách khiếu nại như vậy thì bỏ luôn shop",
        "Nói quá quá mức như trong live là lừa dối người mua đó",
        "Clip host chê khách đang lan rồi, ai chưa xem?",
        "Host cáu gắt với khách hàng trên sóng, tôi sốc thật sự",
        "Cắt sóng đi shop, đừng để khủng hoảng thêm",
        "Tôi đã mua 5 lần mà thấy host nói vậy quá thất vọng",
        "Đoạn host nói 'khách nghèo' ai chụp màn hình chưa?",
        "Tag vài trang tin đưa tin vào xem nào",
        "Shop im lặng luôn hả? Xin lỗi đi chứ!",
      ],
    },
    // P4 · Lan truyền — clip cắt, trend, báo chí bắt đầu đưa tin
    {
      fromTick: 16,
      toTick: 18,
      texts: [
        "Clip host chê khách lên trend TikTok rồi, 2 triệu views",
        "Hashtag #SauRiengVamom đang trending kìa",
        "Trang fanpage lớn vừa cắt clip đăng lên rồi",
        "Báo chí bắt đầu đưa tin về phiên live hôm nay",
        "Nhóm review lớn tổng hợp toàn bộ phát ngôn sai",
        "Facebook đang chia sẻ rầm rộ đoạn host cáu gắt",
      ],
    },
    // P5 · Xử lý theo playbook — xin lỗi + bằng chứng kiểm định + đổi trả
    {
      fromTick: 19,
      toTick: 21,
      texts: [
        "Shop vừa đăng video xin lỗi trên fanpage chính thức",
        "Biên bản kiểm định từng lô đã được up lên page",
        "Host vừa đính chính lại cam kết ngay trên live",
        "Đơn bị trễ được hoàn tiền 100% + voucher",
        "Cảm ơn shop đã phản hồi nhanh, tôi tin tưởng lại",
        "Kiểm định rõ ràng vậy thì tôi yên tâm đặt",
      ],
    },
    // P6 · Hạ nhiệt — không khí phiên live trở lại bình thường
    {
      fromTick: 22,
      toTick: 24,
      texts: [
        "Tiếp tục chương trình, hôm nay còn nhiều deal lắm",
        "Cơm vàng hạt lép thật sự, đã mua lần 3",
        "Đóng gói cẩn thận, giao đúng hẹn",
        "Chốt đơn tiếp nào, số lượng có hạn",
        "Deal hôm nay xứng đáng từng đồng",
        "Ủng hộ shop nhiều nhé mọi người",
      ],
    },
  ];
}

// ---- Kịch bản 2: phiên live ĐANG khủng hoảng (đi thẳng vào cao trào) ----
// Dùng khi muốn demo luồng xử lý khủng hoảng ngay lập tức: bắt đầu ở P3.
function crisisLiveScenes(productHint: string): Scene[] {
  return [
    // Không khí sôi động ngắn
    {
      fromTick: 1,
      toTick: 2,
      texts: [
        `Chào cả nhà, ${productHint} hôm nay deal khủng`,
        "Số lượng có hạn, chốt nhanh kẻo hết",
        "Deal sốc chỉ có trong live hôm nay",
      ],
    },
    // Khiếu nại dồn dập ngay lập tức
    {
      fromTick: 3,
      toTick: 5,
      texts: [
        "Đơn 2 tuần chưa thấy hàng đâu cả",
        "Hoàn tiền tôi chưa thấy xử lý",
        "Hàng nhận được sai mẫu, cần đổi gấp",
        "Chăm sóc khách trả lời kiểu gì vậy?",
        "Giao trễ làm quà tặng mất mất mặt rồi",
        "Shop chăm khách kiểu này mất khách à?",
        "Đơn của tôi đang ở đâu vậy shop?",
        "Khiếu nại mãi không ai giải quyết",
        "Tôi đã đặt 5 đơn mà 3 đơn lỗi",
        "CSKH toàn trả lời máy móc",
        "Tôi cần nói chuyện trực tiếp với quản lý",
        "Khách hàng bị đối xử kiểu này buồn thật",
      ],
    },
    // VẠ MỘM + lan truyền KHÔNG nghỉ — phiên live đang cháy
    {
      fromTick: 6,
      toTick: 15,
      texts: [
        "Host vừa chê khách 'nghèo mà đòi xịn' ngay trên live!!!",
        "Clip host cáu gắt với khách khiếu nại đang viral",
        "Anh khách mời cam kết 'không quả nào xấu' là quảng cáo quá sự thật",
        "Tag mấy trang tin đưa tin vào xem nào",
        "Host xúc phạm khách hàng, báo chí đưa rồi",
        "#SauRiengVamom lên trending mất rồi shop ơi",
        "Đoạn host nói 'khách nghèo' ai chụp màn hình chưa?",
        "Tôi từng ủng hộ shop, nhưng phát ngôn này quá đáng",
        "Cắt sóng đi, đừng để khủng hoảng thêm",
        "Quản lý thương hiệu vào phản hồi đi chứ!",
        "Shop im lặng quá, tệ hơn nữa đó",
        "Ai lưu clip chưa, up lên nhóm review lớn đi",
        "Host vừa nói thêm 'khách không mua đừng ở đây' nữa rồi",
        "Nhóm 50k thành viên đang chia sẻ clip này",
        "TikTok 2 triệu views rồi, lên trend rồi",
        "Thiệt hại thương hiệu rồi, phải xin lỗi công khai",
        "Mời luật sư vào xem phát ngôn này với",
        "Brand vừa đăng thông cáo chưa vậy??",
        "Xin lỗi đi rồi mới nói tiếp bán hàng",
        "Quan trọng là cách shop xử lý sau sự cố",
        "Tôi sẽ tiếp tục theo dõi cách shop phản hồi",
        "Đang chờ thông cáo chính thức từ shop",
        "Nếu xử lý tốt, tôi vẫn có thể tin tưởng lại",
        "Mọi người bình tĩnh, chờ shop lên tiếng",
        "Vẫn còn cơ hội nếu shop xin lỗi đúng cách",
        "Chờ xem shop xử lý kiểu gì đã",
        "Thông cáo lên trang chủ chưa shop ơi?",
        "Cần thấy hành động cụ thể, không chỉ lời nói",
        "Đền bù đơn lỗi + xin lỗi công khai là được",
        "Quản lý khủng hoảng tốt thì khách vẫn quay lại",
      ],
    },
    // Xử lý + hạ nhiệt nhanh (playbook đang chạy)
    {
      fromTick: 16,
      toTick: 20,
      texts: [
        "Shop vừa phát thông cáo xin lỗi chính thức",
        "Host xin lỗi khách hàng ngay trên live",
        "Cam kết hoàn tiền 100% cho đơn bị lỗi",
        "Kiểm định từng lô đã up lên page",
        "Cảm ơn shop đã phản hồi nhanh",
        "Xem ra shop xử lý khủng hoảng bài bản",
        "Tôi sẽ cho shop một cơ hội nữa",
        "Đơn bị trễ được đền voucher 200k",
        "Clip xin lỗi đang lan, tín hiệu tốt",
        "Nhóm review chuyển sang ủng hộ shop",
        "Deal hôm nay vẫn giá tốt đấy",
        "Chốt 1 đơn ủng hộ shop",
        "Hy vọng shop rút kinh nghiệm lần sau",
        "Chăm sóc khách cải thiện rõ rồi",
        "Kết thúc phiên live nhẹ nhàng nha",
        "Cảm ơn mọi người đã theo dõi",
      ],
    },
  ];
}

// ---- Kịch bản 3: trộn nhiều loại rủi ro (kiểu demo cũ) — cho xem tổng thể ----
function classicMixScenes(productHint: string): Scene[] {
  return [
    {
      fromTick: 1,
      toTick: 4,
      texts: [
        `Cho em hỏi giá ${productHint} với ạ`,
        "Sản phẩm này giá bao nhiêu ạ?",
        "Giá tiền bao nhiêu vậy shop?",
        "Order khi nào nhận được ạ?",
        "Cho hỏi vận chuyển Hà Nội bao lâu?",
        "Phí ship về tỉnh bao nhiêu ạ?",
        "Live hôm nay nhiều deal quá ạ",
        "Xin mã giảm giá với ạ",
        "Cho em xem lại phần demo sản phẩm",
        "Quà tặng kèm có gì không ạ?",
        "Mai còn live không shop?",
        "Có freeship không ạ?",
      ],
    },
    {
      fromTick: 5,
      toTick: 9,
      texts: [
        "Đặt 2 tuần rồi chưa nhận được hàng",
        "Đơn của tôi giao trễ quá lâu rồi",
        "Hàng giao sai mẫu, cần đổi trả gấp",
        "Shipper giao trễ, không ai trả lời",
        "Chưa nhận được hàng mà đơn đã closed",
        "Giao trễ 10 ngày rồi, khi nào có hàng?",
        "Đơn thất lạc rồi shop ơi, xử lý giúp em",
        "Trả hàng rồi mà chưa được hoàn tiền",
        "Bản thảo đơn tôi vẫn chưa thấy cập nhật",
        "Khổ quá, đặt quà tặng giờ chưa tới",
        "Chưa thấy shop phản hồi đơn của tôi",
        "Vận đơn của tôi bị treo 4 ngày rồi",
      ],
    },
    {
      fromTick: 8,
      toTick: 12,
      texts: [
        `${productHint} có chứng nhận kiểm định không vậy?`,
        "Nghe nói bị thu hồi vì không rõ nguồn gốc, thật không?",
        "Hàng giả nhiều lắm, làm sao phân biệt?",
        "Quảng cáo cam kết đặc biệt là lừa đảo không?",
        "Có ai kiểm định chứng nhận của bộ nông nghiệp chưa ạ?",
        "Bạn nào dùng thấy cam kết chất lượng chưa? Tôi nghi lắm.",
        "Host vừa chê khách 'nghèo mà đòi xịn' là sao vậy shop?",
        "Ai quay lại đoạn host xúc phạm khách chưa, up lên xem nào",
        "Thái độ với khách khiếu nại như vậy thì bỏ luôn shop",
      ],
    },
    {
      fromTick: 11,
      toTick: 14,
      texts: [
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
        "Kiếm tiền online click link ngay: http://bit.ly/zzz",
      ],
    },
    {
      fromTick: 14,
      toTick: 20,
      texts: [
        "Đẹp quá shop ơi",
        "Sản phẩm dùng tốt thật sự ạ",
        "Yêu shop, ủng hộ chủ shop",
        "Chất lượng tuyệt vời, đã mua lần 3",
        "Đẹp quá, chốt đơn ngay",
        "Hay quá, cho em 1 đơn",
        "Tuyệt vời, cho em xin mã giảm giá",
        "Ủng hộ shop nhiều nhé",
        "Good too good, love this",
        "Mai còn live không shop?",
        `Đơn ${productHint} chạy ok lắm mọi người ơi`,
        "Da em cải thiện rõ sau 2 tuần",
      ],
    },
  ];
}

export const SCENARIOS: Record<ScenarioId, ScenarioMeta & { scenes: (productHint: string) => Scene[] }> = {
  o_sau_rieng: {
    id: "o_sau_rieng",
    name: "Case O sầu riêng (10/2024)",
    description:
      "Tái hiện case thật: bán sầu riêng sôi động → khiếu nại giao hàng → nghi vấn cam kết → host 'vạ mồm' → lan truyền → xin lỗi + bằng chứng kiểm định → hạ nhiệt.",
    productHint: "sầu riêng Ri6",
    category: "food",
    platforms: ["tiktok", "facebook", "shopee"],
    scenes: oSauRiengScenes,
  },
  crisis_live: {
    id: "crisis_live",
    name: "Phiên live đang khủng hoảng",
    description:
      "Bắt đầu ngay khi phiên live đang cháy: khiếu nại dồn dập + 'vạ mồm' lan truyền liên tục → xử lý theo playbook → hạ nhiệt. Dùng để tập xử lý real-time.",
    productHint: "combo quà tặng",
    category: "other",
    platforms: ["facebook", "tiktok"],
    scenes: crisisLiveScenes,
  },
  classic_mix: {
    id: "classic_mix",
    name: "Trộn nhiều loại rủi ro",
    description:
      "Kiểu demo tổng hợp cũ: hỏi giá → khiếu nại → nghi vấn → spam → tích cực. Dùng để xem đủ mọi loại alert trong một phiên.",
    productHint: "sản phẩm",
    category: "other",
    platforms: ["facebook", "tiktok", "shopee"],
    scenes: classicMixScenes,
  },
};

export const SCENARIO_LIST: Array<ScenarioMeta> = Object.values(SCENARIOS).map(
  ({ id, name, description, productHint, category, platforms }) => ({ id, name, description, productHint, category, platforms }),
);

// Phase hiển thị của kịch bản o_sau_rieng (và dùng làm fallback cho kịch bản khác)
export function phasesFor(id: ScenarioId): Phase[] {
  if (id === "o_sau_rieng") {
    return [
      { fromTick: 1, toTick: 4, label: "Khởi động phiên", hint: "Không khí bán hàng bình thường" },
      { fromTick: 5, toTick: 8, label: "Áp lực vận hành", hint: "Khiếu nại giao hàng dồn dập" },
      { fromTick: 9, toTick: 11, label: "Nghi vấn cam kết", hint: "Khách đòi bằng chứng kiểm định" },
      { fromTick: 12, toTick: 15, label: "⚠️ VẠ MỘM", hint: "Host/KOL chê khách + cam kết sai — cao trào" },
      { fromTick: 16, toTick: 18, label: "Lan truyền", hint: "Clip cắt, trend, báo chí đưa tin" },
      { fromTick: 19, toTick: 21, label: "Xử lý theo playbook", hint: "Xin lỗi + bằng chứng + đền bù" },
      { fromTick: 22, toTick: 24, label: "Hạ nhiệt", hint: "Phiên live trở lại bình thường" },
    ];
  }
  if (id === "crisis_live") {
    return [
      { fromTick: 1, toTick: 2, label: "Khởi động", hint: "Không khí sôi động" },
      { fromTick: 3, toTick: 5, label: "Áp lực vận hành", hint: "Khiếu nại dồn dập" },
      { fromTick: 6, toTick: 15, label: "🔥 KHỦNG HOẢNG", hint: "'Vạ mồm' + lan truyền liên tục" },
      { fromTick: 16, toTick: 20, label: "Xử lý & hạ nhiệt", hint: "Playbook + xin lỗi + đền bù" },
    ];
  }
  return [
    { fromTick: 1, toTick: 4, label: "Bình thường", hint: "Hỏi giá, ship, demo" },
    { fromTick: 5, toTick: 9, label: "Áp lực vận hành", hint: "Khiếu nại giao hàng" },
    { fromTick: 8, toTick: 12, label: "Nghi vấn & vạ mồm", hint: "Claim + host chê khách" },
    { fromTick: 11, toTick: 14, label: "Spam", hint: "Link lặp lại" },
    { fromTick: 14, toTick: 20, label: "Tích cực", hint: "Volume cao bình thường" },
  ];
}

// ---- Sinh message TẤT ĐỊNH theo tick (thay cho textsForTick ngẫu nhiên cũ) ----

// Chọn author từ vai diễn theo index (tất định)
export function authorForIndex(i: number): string {
  return authorFor(i);
}

// messagesForTick: trả về ĐÚNG các message sẽ xuất hiện ở tick đó (theo thứ tự
// khai báo trong scenes), lấp đầy còn thiếu bằng message nền (ambient).
export function messagesForTick(tick: number, scenarioId: ScenarioId, productHintOverride?: string): Array<{ text: string; author: string; platform: Platform }> {
  const meta = SCENARIOS[scenarioId] ?? SCENARIOS.o_sau_rieng;
  const productHint = productHintOverride ?? meta.productHint;
  const script = meta.scenes(productHint);
  const ambient = [
    "Live hôm nay nhiều deal quá ạ",
    "Xin mã giảm giá với ạ",
    "Cho em xem lại phần demo sản phẩm",
  ];
  const out: Array<{ text: string; author: string; platform: Platform }> = [];
  for (const s of script) {
    if (tick >= s.fromTick && tick <= s.toTick) {
      for (const text of s.texts) {
        out.push({
          text,
          author: authorForIndex(out.length),
          platform: meta.platforms[out.length % meta.platforms.length]!,
        });
      }
    }
  }
  // Nếu phase hiện tại không có message cụ thể (ngoài timeline) → nền ambient
  let ambientIdx = 0;
  while (out.length < SIM_MESSAGES_PER_TICK) {
    out.push({
      text: ambient[ambientIdx % ambient.length]!,
      author: authorForIndex(out.length),
      platform: meta.platforms[out.length % meta.platforms.length]!,
    });
    ambientIdx += 1;
  }
  // Giới hạn mỗi tick tối đa SIM_MESSAGES_PER_TICK message: ưu tiên message phase
  // (theo thứ tự khai báo) rồi mới đến ambient.
  return out.slice(0, SIM_MESSAGES_PER_TICK);
}

// currentPhase: phase đang diễn ra ở tick hiện tại (để UI hiển thị label)
export function currentPhase(tick: number, scenarioId: ScenarioId): Phase | null {
  const phases = phasesFor(scenarioId);
  return phases.find((p) => tick >= p.fromTick && tick <= p.toTick) ?? null;
}
