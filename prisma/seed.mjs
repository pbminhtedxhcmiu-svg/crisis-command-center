// Seed demo data — chạy: npm run db:seed
// 10 user (mỗi vai trò 1 user) + workspace "Nova Beauty" + brand/campaign/event demo.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "crisis2026";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "ws_demo_nova" },
    update: {},
    create: { id: "ws_demo_nova", name: "Nova Beauty (Demo)" },
  });

  const roles = ["OWNER", "CRISIS_LEAD", "BRAND_MANAGER", "PRODUCER", "MODERATOR", "CUSTOMER_SERVICE", "LEGAL_REVIEWER", "EXEC_VIEWER", "ANALYST", "AGENCY"];
  const users = {};
  for (const role of roles) {
    const email = `${role.toLowerCase()}@nova.demo`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${role} Nova`,
        passwordHash: hashPassword(DEFAULT_PASSWORD),
      },
    });
    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role },
      create: { workspaceId: workspace.id, userId: user.id, role },
    });
    users[role] = user;
  }

  const brand = await prisma.brand.upsert({
    where: { id: "brand_nova" },
    update: {},
    create: {
      id: "brand_nova",
      workspaceId: workspace.id,
      name: "Nova Beauty",
      description: "Mỹ phẩm organic cho thị trường Việt Nam",
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: "camp_115" },
    update: {},
    create: {
      id: "camp_115",
      workspaceId: workspace.id,
      brandId: brand.id,
      name: "11/11 Mega Sale Livestream",
      objective: "Doanh số 2 tỷ + giữ reputation trong giờ cao điểm",
    },
  });

  const playbook = await prisma.playbook.upsert({
    where: { id: "pb_livestream" },
    update: {},
    create: {
      id: "pb_livestream",
      workspaceId: workspace.id,
      name: "Livestream Crisis Playbook",
      description: "Quy trình xử lý khủng hoảng trong live bán hàng",
    },
  });

  // Playbook 'Rủi ro phát ngôn host/KOL' — bài học case O sầu riêng 10/2024:
  // checklist trước live + từ khóa cảnh báo bơm vào classifier/simulator
  const hostPb = await prisma.playbook.upsert({
    where: { id: "pb_host_statement" },
    update: {},
    create: {
      id: "pb_host_statement",
      workspaceId: workspace.id,
      name: "Rủi ro phát ngôn host/KOL (vạ mồm)",
      description: "Phòng và xử lý khủng hoảng do phát ngôn xúc phạm khách/cam kết sai của host hoặc khách mời trong live.",
      riskKeywords: JSON.stringify([
        "vạ mồm", "chê khách", "nói xấu khách", "xúc phạm khách", "nghèo mà đòi",
        "quảng cáo quá sự thật", "cam kết sai", "nói quá", "hứa suông",
        "host xúc phạm", "thái độ với khách", "quang linh",
      ]),
    },
  });
  const hostChecklist = [
    ["Brief phát ngôn trước live: danh sách điều KHÔNG được nói (không chê khách, không cam kết ngoài kịch bản)", "Host + KOL ký nhận trước giờ G"],
    ["Kiểm tra kịch bản: mọi con số/cam kết sản phẩm phải có hồ sơ kiểm định kèm theo", "Brand Manager xác nhận"],
    ["Chuẩn bị phản ứng nhanh cho 3 tình huống: khách chê hàng, host nói sai số liệu, KOL nói quá công dụng", "Producer giữ sẵn câu thoại đính chính"],
    ["Phân công 1 moderator trực luồng theo dõi phát ngôn + comment trích dẫn lời nói của host/KOL", "Không rời ghế trong suốt phiên live"],
    ["Quay toàn bộ phiên live để làm bằng chứng phản bác/đính chính", "VOD lưu tối thiểu 90 ngày"],
    ["Chốt kênh xin lỗi/đính chính nếu sự cố xảy ra: template công bố + người duyệt", "Legal duyệt trước khi đăng"],
  ];
  for (let i = 0; i < hostChecklist.length; i++) {
    const [label, detail] = hostChecklist[i];
    await prisma.playbookChecklistItem.upsert({
      where: { id: `pbhs_item_${i + 1}` },
      update: { label, detail, position: i },
      create: { id: `pbhs_item_${i + 1}`, playbookId: hostPb.id, position: i, label, detail },
    });
  }

  // Playbook 'Hàng giả / Hàng nhái / Xâm phạm thương hiệu' — tổng hợp từ case
  // Biti's Hunter, Nike/Adidas counterfeit VN, Tân Hiệp Phát, FoodMap, QLTT 2024–2026.
  // 3 Track: A (hàng thật bị hiểu nhầm) · B (hàng giả xác nhận) · C (cơ quan chức năng vào cuộc).
  const counterfeitPb = await prisma.playbook.upsert({
    where: { id: "pb_counterfeit" },
    update: {},
    create: {
      id: "pb_counterfeit",
      workspaceId: workspace.id,
      name: "Hàng giả / Hàng nhái / Xâm phạm thương hiệu",
      description:
        "Phòng và xử lý khủng hoảng hàng giả trong livestream: immediate action protocol 5 phút đầu, Track A (hàng thật bị nghi oan), Track B (hàng giả xác nhận — hoàn tiền 100%), Track C (QLTT/Công an vào cuộc). Nguồn: case Biti's Hunter, FoodMap 07/2024, QLTT enforcement 2024–2026.",
      riskKeywords: JSON.stringify([
        "hàng giả", "hàng nhái", "hàng fake", "fake", "tem giả", "khác hình",
        "xâm phạm thương hiệu", "giả mạo", "lừa đảo", "không chính hãng", "hàng dựng",
      ]),
    },
  });
  const counterfeitChecklist = [
    ["Hồ sơ IP Documentation sẵn sàng cho mọi SKU: CO/CQ, hóa đơn VAT (không chỉ biên nhận), hợp đồng đại lý/authorization letter từ brand gốc", "Brand Manager — rà soát trước mỗi phiên có SKU mới"],
    ["QC kiểm physical product ngay trước giờ live — quy tắc 1 người QC độc lập, không bỏ qua dù quen mặt hàng", "QC Lead — chụp ảnh lô hàng làm bằng chứng gốc"],
    ["Chuẩn bị sẵn ảnh so sánh hàng thật vs hàng nhái + serial/hologram chuẩn để đăng khi bị tố cáo", "PR Lead — upload kho nội bộ, kiểm tra link còn sống"],
    ["Keyword alert 'hàng giả/fake/nhái/tem giả/khác hình' — SLA phản hồi 30 phút, 24/7", "MOD team — 3+ comment cùng chủ đề/10 phút = alert Brand Manager ngay"],
    ["Chốt 1 spokesperson duy nhất + cả team thuộc lòng 3 câu KHÔNG được nói khi bị tố cáo hàng giả", "CEO — ký nhận trước giờ live"],
    ["Contact card điền sẵn: luật sư SHTT/thương mại (retainer), hotline QLTT 1800 888 655, TikTok Shop Brand Support", "CEO — in giấy dán tại phòng live"],
    ["Crisis drill hàng tháng: diễn tập 'khách tố hàng giả trong live' + 'QLTT gõ cửa'", "CRT — ghi nhận kết quả + thời gian phản ứng"],
  ];
  for (let i = 0; i < counterfeitChecklist.length; i++) {
    const [label, detail] = counterfeitChecklist[i];
    await prisma.playbookChecklistItem.upsert({
      where: { id: `pbct_item_${i + 1}` },
      update: { label, detail, position: i },
      create: { id: `pbct_item_${i + 1}`, playbookId: counterfeitPb.id, position: i, label, detail },
    });
  }
  // 4 template phát ngôn theo Track của playbook (đều cần Legal duyệt — rủi ro pháp lý)
  const counterfeitTemplates = [
    {
      id: "tpl_ct_track_a", name: "Track A — Hàng thật bị hiểu nhầm (chứng minh bằng bằng chứng)",
      kind: "comment_reply", channel: "comment", tone: "empathetic",
      body: "Chúng tôi ghi nhận và trân trọng phản ánh của bạn {customer_name}. Chúng tôi vừa hoàn thành kiểm tra độc lập sản phẩm. Kết quả: sản phẩm là hàng chính hãng {brand_name}, nhập từ {source}, hóa đơn VAT {vat_number}. Công khai toàn bộ hồ sơ: {proof_link}. Nếu bạn chưa yên tâm, chúng tôi cam kết đổi trả 100% trong 7 ngày, không cần giải thích.",
      vars: ["customer_name", "brand_name", "source", "vat_number", "proof_link"],
      banned: ["chúng tôi không bao giờ bán hàng giả", "không phải lỗi của chúng tôi"],
    },
    {
      id: "tpl_ct_track_b1", name: "Track B — Phát ngôn 1: Thừa nhận đang điều tra (< 2 giờ)",
      kind: "host_notice", channel: "social_post", tone: "empathetic",
      body: "{brand_name} xác nhận đang tiến hành điều tra khẩn sau phản ánh về chất lượng sản phẩm {product_name}. Toàn bộ đơn hàng lô {batch_number} đã được tạm dừng giao. Khách hàng có đơn liên quan vui lòng liên hệ {hotline} — chúng tôi cam kết xử lý trong 24 giờ. Cập nhật tiếp theo: {next_update_time}.",
      vars: ["brand_name", "product_name", "batch_number", "hotline", "next_update_time"],
      banned: ["bằng chứng này là giả mạo", "khách hàng cố tình bôi nhọ"],
    },
    {
      id: "tpl_ct_track_b2", name: "Track B — Phát ngôn 2: Kết quả điều tra + hoàn tiền 100% (< 6 giờ)",
      kind: "host_notice", channel: "press_release", tone: "empathetic",
      body: "Sau điều tra độc lập, chúng tôi xác nhận lô {batch_number} có {defect_count} sản phẩm không đáp ứng tiêu chuẩn chính hãng. Chúng tôi xin lỗi toàn bộ {affected_orders} khách hàng bị ảnh hưởng. Hành động ngay: (1) Hoàn tiền 100% trong 48 giờ, không điều kiện. (2) Nhà cung cấp đã bị chấm dứt hợp đồng. (3) Sản phẩm còn lại được tiêu hủy có xác nhận của cơ quan chức năng. Chúng tôi chịu hoàn toàn trách nhiệm vì đây là hàng chúng tôi đã bán đến tay bạn.",
      vars: ["batch_number", "defect_count", "affected_orders"],
      banned: ["đổ lỗi cho nhà cung cấp trước mặt công chúng", "một số khách hàng hiểu lầm"],
    },
    {
      id: "tpl_ct_track_c", name: "Track C — Phát ngôn DUY NHẤT khi cơ quan chức năng vào cuộc",
      kind: "internal_notice", channel: "press_release", tone: "formal",
      body: "{brand_name} xác nhận đang hợp tác đầy đủ với cơ quan chức năng trong quá trình điều tra. Chúng tôi cam kết minh bạch và tuân thủ pháp luật. Mọi thông tin chi tiết sẽ được công bố sau khi có kết luận chính thức. (KHÔNG nói thêm gì — lặp lại nguyên văn với mọi câu hỏi của báo chí. Chỉ spokesperson được chỉ định mới được phát ngôn.)",
      vars: ["brand_name"],
      banned: ["tiết lộ thông tin điều tra", "phản công kích báo chí", "phát ngôn khi chưa có clearance luật sư"],
    },
  ];
  for (const t of counterfeitTemplates) {
    await prisma.responseTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        workspaceId: workspace.id,
        playbookId: counterfeitPb.id,
        name: t.name,
        kind: t.kind,
        situationTopic: "product_claim",
        channel: t.channel,
        tone: t.tone,
        body: t.body,
        variables: JSON.stringify(t.vars),
        bannedClaims: JSON.stringify(t.banned),
        approverRole: "LEGAL_REVIEWER",
      },
    });
  }

  const event = await prisma.liveEvent.upsert({
    where: { id: "evt_demo_1" },
    update: {},
    create: {
      id: "evt_demo_1",
      workspaceId: workspace.id,
      brandId: brand.id,
      campaignId: campaign.id,
      name: "Nova Serum Mega Sale — 11/11",
      status: "DRAFT",
      dataMode: "DEMO",
      scheduledAt: new Date(Date.now() + 86400_000),
      platforms: JSON.stringify(["facebook", "tiktok", "shopee"]),
      products: JSON.stringify([{ name: "Nova Serum", offer: "Giảm 40% + quà tặng", category: "cosmetics" }]),
      hostUserId: users.MODERATOR.id,
      producerUserId: users.PRODUCER.id,
      playbookId: playbook.id,
      riskKeywords: JSON.stringify(["lừa đảo", "hàng giả", "chứng nhận", "giao trễ", "thất lạc", "ngộ độc"]),
      oncallUserIds: JSON.stringify([users.CUSTOMER_SERVICE.id, users.MODERATOR.id]),
      escalationUserId: users.CRISIS_LEAD.id,
    },
  });

  await prisma.policyRule.upsert({
    where: { id: "pr_delivery" },
    update: {},
    create: {
      id: "pr_delivery",
      workspaceId: workspace.id,
      name: "Burst khiếu nại giao hàng",
      riskType: "delivery",
      keywords: JSON.stringify(["giao trễ", "thất lạc", "chưa nhận", "sai hàng", "đổi trả"]),
      minVelocity: 3,
      priority: "P1",
    },
  });
  await prisma.policyRule.upsert({
    where: { id: "pr_claim" },
    update: {},
    create: {
      id: "pr_claim",
      workspaceId: workspace.id,
      name: "Claim sản phẩm bị nghi ngờ",
      riskType: "product_claim",
      keywords: JSON.stringify([
        "chứng nhận", "lừa đảo", "hàng giả", "kiểm định",
        // claim doubts đặc thù theo ngành hàng (đồng bộ src/lib/crisis/categories.ts)
        "ngộ độc", "kích ứng", "bào mòn da", "trộn chì", "trộn corticoid",
        "hết hạn", "hết date", "chứa chất cấm", "hàng nhái", "hàng dựng", "nổ pin",
      ]),
      minVelocity: 2,
      priority: "P1",
    },
  });
  await prisma.policyRule.upsert({
    where: { id: "pr_spam" },
    update: {},
    create: { id: "pr_spam", workspaceId: workspace.id, name: "Spam link", riskType: "spam", keywords: JSON.stringify(["click link", "bit.ly"]), minVelocity: 3, priority: "P3" },
  });

  const templates = [
    { id: "tpl_price", name: "Trả lời hỏi giá", kind: "comment_reply", topic: "pricing", body: "Chào {customer_name}! {product_name} đang có giá {price} trong live hôm nay nhé.", vars: ["customer_name", "product_name", "price"], banned: [] },
    { id: "tpl_ship", name: "Trả lời hỏi vận chuyển", kind: "comment_reply", topic: "shipping", body: "Dạ {customer_name}, đơn của bạn sẽ được giao trong {eta}.", vars: ["customer_name", "eta"], banned: [] },
    { id: "tpl_delivery", name: "Xin lỗi khiếu nại giao hàng", kind: "comment_reply", topic: "delivery", body: "{customer_name} ơi, Nova rất tiếc về trải nghiệm [{order_id}]. Team sẽ liên hệ trong 30 phút để xử lý và cam kết đổi trả theo chính sách.", vars: ["customer_name", "order_id"], banned: ["cam kết hoàn tiền 100%", "đền bù gấp đôi"] },
    { id: "tpl_claim", name: "Phản hồi nghi ngờ claim (cần Legal duyệt)", kind: "comment_reply", topic: "product_claim", body: "Nova cam kết {product_name} có {certification}.", vars: ["product_name", "certification"], banned: ["trị dứt điểm", "chữa khỏi", "đảm bảo 100%"] },
    { id: "tpl_host", name: "Nhắc host điều chỉnh kịch bản", kind: "host_notice", topic: "other", body: "Host ơi, đang có tín hiệu {topic} tăng bất thường ({count} comments/phút). Đề nghị đọc template \"{template_name}\" trên air.", vars: ["topic", "count", "template_name"], banned: [] },
    { id: "tpl_internal", name: "Thông báo nội bộ stakeholder", kind: "internal_notice", topic: "other", body: "[INTERNAL] Incident {incident_code} đang ở severity {severity}. Đề nghị {role} theo dõi kênh war-room.", vars: ["incident_code", "severity", "role"], banned: [] },
  ];
  for (const t of templates) {
    await prisma.responseTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        workspaceId: workspace.id,
        playbookId: playbook.id,
        name: t.name,
        kind: t.kind,
        situationTopic: t.topic,
        channel: t.kind === "comment_reply" ? "comment" : "internal",
        tone: t.topic === "delivery" ? "empathetic" : "professional",
        body: t.body,
        variables: JSON.stringify(t.vars),
        bannedClaims: JSON.stringify(t.banned),
        approverRole: t.topic === "product_claim" ? "LEGAL_REVIEWER" : null,
      },
    });
  }

  await prisma.platformConnection.upsert({
    where: { workspaceId_platform: { workspaceId: workspace.id, platform: "facebook" } },
    update: {},
    create: { workspaceId: workspace.id, platform: "facebook", status: "CONNECTED", externalRef: "demo-fb-page-1" },
  });
  await prisma.platformConnection.upsert({
    where: { workspaceId_platform: { workspaceId: workspace.id, platform: "tiktok" } },
    update: {},
    create: { workspaceId: workspace.id, platform: "tiktok", status: "CONNECTED", externalRef: "demo-tt-1" },
  });
  await prisma.platformConnection.upsert({
    where: { workspaceId_platform: { workspaceId: workspace.id, platform: "shopee" } },
    update: {},
    create: { workspaceId: workspace.id, platform: "shopee", status: "DELAYED", externalRef: "demo-sp-1" },
  });

  console.log("Seed OK (v1.0.0) — workspace:", workspace.name);
  console.log("Login: owner@nova.demo / crisis2026 (và 9 vai trò khác @nova.demo)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
