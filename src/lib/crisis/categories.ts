import type { ProductCategory } from "@/lib/constants";
import { DEFAULT_PRODUCT_CATEGORY } from "@/lib/constants";

// Meta theo DANH MỤC MẶT HÀNG — nguồn chân lý cho classifier + simulator nội dung demo.
// Thêm ngành hàng mới: thêm 1 key ở đây, mọi màn hình/pipeline tự nhận (không phải sửa gì khác).
export type CategoryMeta = {
  /** Nhãn hiển thị UI (tiếng Việt) */
  label: string;
  /** Nghi vấn đặc thù ngành — gộp vào keywords của rule product_claim trong classifier */
  claimDoubts: string[];
  /** Cam kết quảng cáo dễ gây nghi ngờ — dùng để sinh nội dung demo */
  claimBenefits: string[];
  /** Cơ quan/tiêu đề kiểm định hay được nhắc tới trong ngành */
  authority: string;
};

export const PRODUCT_CATEGORY_META: Record<ProductCategory, CategoryMeta> = {
  cosmetics: {
    label: "Mỹ phẩm / Làm đẹp",
    claimDoubts: ["ngộ độc", "kích ứng", "bào mòn da", "trộn chì", "trộn corticoid"],
    claimBenefits: ["trắng da cấp tốc", "trị mụn dứt điểm", "trị sẹo rỗ"],
    authority: "Bộ Y tế",
  },
  food: {
    label: "Thực phẩm / Đồ uống",
    claimDoubts: ["ngộ độc", "hết hạn", "hết date", "không rõ nguồn gốc", "gây dị ứng"],
    claimBenefits: ["giảm cân cấp tốc", "đã kiểm nghiệm lâm sàng"],
    authority: "Bộ Y tế",
  },
  supplement: {
    label: "Thực phẩm chức năng",
    claimDoubts: ["chứa chất cấm", "tái phát", "không rõ nguồn gốc", "gây tác dụng phụ"],
    claimBenefits: ["chữa khỏi", "đặc trị", "thay thế thuốc"],
    authority: "Bộ Y tế",
  },
  fashion: {
    label: "Thời trang",
    claimDoubts: ["vải kém chất lượng", "xù lông", "phai màu", "mực in độc hại"],
    claimBenefits: ["form chuẩn 100% như hình", "vải xịn Ý"],
    authority: "nhãn hiệu chính hãng",
  },
  electronics: {
    label: "Điện tử / Công nghệ",
    claimDoubts: ["hàng dựng", "IMEI bị khóa", "hàng trôi nổi", "pin kém chất lượng", "nổ pin"],
    claimBenefits: ["bảo hành vàng", "chính hãng 100%"],
    authority: "nhà sản xuất",
  },
  home: {
    label: "Gia dụng / Nội thất",
    claimDoubts: ["gãy vỡ khi giao", "chất lượng kém", "chứa formaldehyde", "gỉ sét"],
    claimBenefits: ["bền 10 năm", "an toàn tuyệt đối"],
    authority: "tiêu chuẩn chất lượng",
  },
  mother_baby: {
    label: "Mẹ & Bé",
    claimDoubts: ["kích ứng da bé", "chất độc", "hàng nhái", "không rõ xuất xứ"],
    claimBenefits: ["an toàn tuyệt đối cho bé", "tăng cân cấp tốc"],
    authority: "Bộ Y tế",
  },
  other: {
    label: "Khác",
    claimDoubts: ["kém chất lượng", "không rõ nguồn gốc"],
    claimBenefits: ["cam kết 100% hài lòng"],
    authority: "cơ quan kiểm định",
  },
};

export function categoryMeta(category: string | null | undefined): CategoryMeta {
  return PRODUCT_CATEGORY_META[(category ?? DEFAULT_PRODUCT_CATEGORY) as ProductCategory] ?? PRODUCT_CATEGORY_META.other;
}
