import { prisma } from "@/lib/db";

/**
 * Bootstrap starter kit cho workspace mới — để mọi user đăng ký đều dùng được ngay
 * mà không phải tự tay tạo brand/playbook/templates. Nội dung là "mẫu khởi đầu"
 * (không phải demo data rác): user có thể sửa/xoá thoải mái.
 * Chạy idempotent trong transaction để workspace không bao giờ rơi vào trạng thái nửa vời.
 */
export async function bootstrapWorkspaceStarterKit(workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const already = await tx.brand.findFirst({ where: { workspaceId } });
    if (already) return; // idempotent — workspace đã có dữ liệu thì không đụng vào

    const brand = await tx.brand.create({
      data: {
        workspaceId,
        name: "Brand chính",
        description: "Brand đầu tiên của workspace — đổi tên theo thương hiệu của bạn",
      },
    });

    const playbook = await tx.playbook.create({
      data: {
        workspaceId,
        name: "Livestream Crisis Playbook",
        description: "Quy trình xử lý khủng hoảng trong live bán hàng (mẫu khởi đầu)",
      },
    });

    await tx.policyRule.createMany({
      data: [
        {
          workspaceId,
          name: "Burst khiếu nại giao hàng",
          riskType: "delivery",
          keywords: JSON.stringify(["giao trễ", "thất lạc", "chưa nhận", "sai hàng", "đổi trả"]),
          minVelocity: 3,
          priority: "P1",
        },
        {
          workspaceId,
          name: "Claim sản phẩm bị nghi ngờ",
          riskType: "product_claim",
          keywords: JSON.stringify(["chứng nhận", "lừa đảo", "hàng giả", "kiểm định"]),
          minVelocity: 2,
          priority: "P1",
        },
        {
          workspaceId,
          name: "Spam link",
          riskType: "spam",
          keywords: JSON.stringify(["click link", "bit.ly"]),
          minVelocity: 3,
          priority: "P3",
        },
      ],
    });

    await tx.responseTemplate.createMany({
      data: [
        {
          workspaceId,
          playbookId: playbook.id,
          name: "Trả lời hỏi giá",
          kind: "comment_reply",
          situationTopic: "pricing",
          channel: "comment",
          tone: "professional",
          body: "Chào {customer_name}! {product_name} đang có giá {price} trong live hôm nay nhé.",
          variables: JSON.stringify(["customer_name", "product_name", "price"]),
          bannedClaims: JSON.stringify([]),
        },
        {
          workspaceId,
          playbookId: playbook.id,
          name: "Trả lời hỏi vận chuyển",
          kind: "comment_reply",
          situationTopic: "shipping",
          channel: "comment",
          tone: "professional",
          body: "Dạ {customer_name}, đơn của bạn sẽ được giao trong {eta}.",
          variables: JSON.stringify(["customer_name", "eta"]),
          bannedClaims: JSON.stringify([]),
        },
        {
          workspaceId,
          playbookId: playbook.id,
          name: "Xin lỗi khiếu nại giao hàng",
          kind: "comment_reply",
          situationTopic: "delivery",
          channel: "comment",
          tone: "empathetic",
          body: "{customer_name} ơi, chúng tôi rất tiếc về trải nghiệm [{order_id}]. Team sẽ liên hệ trong 30 phút để xử lý và cam kết đổi trả theo chính sách.",
          variables: JSON.stringify(["customer_name", "order_id"]),
          bannedClaims: JSON.stringify(["cam kết hoàn tiền 100%", "đền bù gấp đôi"]),
        },
        {
          workspaceId,
          playbookId: playbook.id,
          name: "Phản hồi nghi ngờ claim (cần Legal duyệt)",
          kind: "comment_reply",
          situationTopic: "product_claim",
          channel: "comment",
          tone: "professional",
          body: "Chúng tôi cam kết {product_name} có {certification}.",
          variables: JSON.stringify(["product_name", "certification"]),
          bannedClaims: JSON.stringify(["trị dứt điểm", "chữa khỏi", "đảm bảo 100%"]),
          approverRole: "LEGAL_REVIEWER",
        },
        {
          workspaceId,
          playbookId: playbook.id,
          name: "Nhắc host điều chỉnh kịch bản",
          kind: "host_notice",
          situationTopic: "other",
          channel: "internal",
          tone: "professional",
          body: "Host ơi, đang có tín hiệu {topic} tăng bất thường ({count} comments/phút). Đề nghị đọc template \"{template_name}\" trên air.",
          variables: JSON.stringify(["topic", "count", "template_name"]),
          bannedClaims: JSON.stringify([]),
        },
        {
          workspaceId,
          playbookId: playbook.id,
          name: "Thông báo nội bộ stakeholder",
          kind: "internal_notice",
          situationTopic: "other",
          channel: "internal",
          tone: "professional",
          body: "[INTERNAL] Incident {incident_code} đang ở severity {severity}. Đề nghị {role} theo dõi kênh war-room.",
          variables: JSON.stringify(["incident_code", "severity", "role"]),
          bannedClaims: JSON.stringify([]),
        },
      ],
    });

    await tx.platformConnection.createMany({
      data: [
        { workspaceId, platform: "facebook", status: "CONNECTED", externalRef: "starter-fb" },
        { workspaceId, platform: "tiktok", status: "CONNECTED", externalRef: "starter-tt" },
      ],
    });

    return { brandId: brand.id, playbookId: playbook.id };
  });
}
