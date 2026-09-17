import { describe, it, expect } from "vitest";
import { renderTemplate, extractVariables, missingVariables, findBannedClaims } from "@/lib/crisis/template";

describe("renderTemplate", () => {
  it("thay biến đúng", () => {
    expect(renderTemplate("Chào {customer_name}, {product_name} giá {price}!", { customer_name: "Minh", product_name: "Nova Serum", price: "299k" }))
      .toBe("Chào Minh, Nova Serum giá 299k!");
  });
  it("thiếu biến → giữ nguyên placeholder (nhìn thấy được)", () => {
    expect(renderTemplate("Chào {customer_name}", {})).toBe("Chào {customer_name}");
  });
  it("không có biến → nguyên văn", () => {
    expect(renderTemplate("Xin lỗi về trải nghiệm.", {})).toBe("Xin lỗi về trải nghiệm.");
  });
});

describe("extractVariables/missingVariables", () => {
  it("extract unique", () => {
    expect(extractVariables("{a} {b} {a}")).toEqual(["a", "b"]);
  });
  it("missing phát hiện biến chưa điền", () => {
    expect(missingVariables("{a} {b}", { a: "1" })).toEqual(["b"]);
  });
});

describe("findBannedClaims", () => {
  it("phát hiện claim cấm bất chấp hoa thường", () => {
    expect(findBannedClaims("Sản phẩm CAM KẾT chữa khỏi!", ["chữa khỏi", "trị dứt điểm"])).toEqual(["chữa khỏi"]);
  });
  it("không có → rỗng", () => {
    expect(findBannedClaims("Sản phẩm an toàn.", ["chữa khỏi"])).toEqual([]);
  });
});
