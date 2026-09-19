import { describe, it, expect } from "vitest";
import { parseTikTokUsername, parseFacebookVideoId } from "@/lib/crisis/connector";

describe("parseTikTokUsername", () => {
  it("trích username từ link live đầy đủ", () => {
    expect(parseTikTokUsername("https://www.tiktok.com/@osaurieng/live")).toBe("osaurieng");
    expect(parseTikTokUsername("https://tiktok.com/@nong.san.daklak/live")).toBe("nong.san.daklak");
  });

  it("nhận @username hoặc username trần", () => {
    expect(parseTikTokUsername("@osaurieng")).toBe("osaurieng");
    expect(parseTikTokUsername("osaurieng")).toBe("osaurieng");
  });

  it("chuẩn hoá hoa/thường", () => {
    expect(parseTikTokUsername("https://www.tiktok.com/@OSauRieng/live")).toBe("osaurieng");
  });

  it("từ chối rỗng và chuỗi không hợp lệ", () => {
    expect(parseTikTokUsername("")).toBeNull();
    expect(parseTikTokUsername("   ")).toBeNull();
    expect(parseTikTokUsername("hello world!")).toBeNull();
    expect(parseTikTokUsername("https://facebook.com/x")).toBeNull();
  });
});

describe("parseFacebookVideoId", () => {
  it("trích id từ link watch", () => {
    expect(parseFacebookVideoId("https://www.facebook.com/watch/?v=123456789012345")).toBe("123456789012345");
  });

  it("trích id từ link videos/ và reel/", () => {
    expect(parseFacebookVideoId("https://facebook.com/mypage/videos/987654321012345/")).toBe("987654321012345");
    expect(parseFacebookVideoId("https://www.facebook.com/reel/555444333222111")).toBe("555444333222111");
  });

  it("nhận videoId trần", () => {
    expect(parseFacebookVideoId("123456789012345")).toBe("123456789012345");
  });

  it("từ chối fb.watch rút gọn và rỗng", () => {
    expect(parseFacebookVideoId("https://fb.watch/abc123")).toBeNull();
    expect(parseFacebookVideoId("")).toBeNull();
    expect(parseFacebookVideoId("not-a-link")).toBeNull();
  });
});
