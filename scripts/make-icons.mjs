#!/usr/bin/env node
/**
 * make-icons.mjs — sinh bộ icon Tauri từ nguồn:
 *   1. .freebuff/icon.png (nếu có) — icon do người dùng cung cấp
 *   2. SVG mặc định (chữ thập cứu trợ + chấm cảnh báo trên nền xanh đậm)
 *
 * Xuất ra src-tauri/icons/: 32x32.png, 128x128.png, 128x128@2x.png, icon.png,
 * icon.ico (Windows) và icon.icns (macOS) — không cần thêm dependency ngoài sharp.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f2a43"/>
  <circle cx="256" cy="256" r="170" fill="#122f4b"/>
  <rect x="226" y="136" width="60" height="240" rx="14" fill="#e8f1f8"/>
  <rect x="136" y="226" width="240" height="60" rx="14" fill="#e8f1f8"/>
  <circle cx="396" cy="132" r="52" fill="#ff5a5a"/>
  <text x="396" y="156" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#ffffff" text-anchor="middle">!</text>
</svg>`;

const source = join(root, ".freebuff", "icon.png");
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("[make-icons] ERROR: sharp không khả dụng — hãy chạy `npm install` trước");
  process.exit(1);
}

const pngBuffers = {};
for (const [name, size] of [["32x32.png", 32], ["128x128.png", 128], ["128x128@2x.png", 256], ["icon.png", 512]]) {
  pngBuffers[name] = await (existsSync(source) ? sharp(source) : sharp(Buffer.from(DEFAULT_SVG)))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(join(outDir, name), pngBuffers[name]);
}

// ICO: nhúng 32/48/64 px
const icoSizes = [32, 48, 64];
const entries = [];
let offset = 6 + 16 * icoSizes.length;
const datas = [];
for (const s of icoSizes) {
  const data = await sharp(pngBuffers["icon.png"]).resize(s, s).png().toBuffer();
  datas.push(data);
  entries.push({ s, size: data.length, offset });
  offset += data.length;
}
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
const dir = Buffer.alloc(16 * icoSizes.length);
entries.forEach((e, i) => {
  const o = i * 16;
  dir.writeUInt8(e.s === 64 ? 0 : e.s, o);
  dir.writeUInt8(e.s === 64 ? 0 : e.s, o + 1);
  dir.writeUInt8(0, o + 2);
  dir.writeUInt8(0, o + 3);
  dir.writeUInt16LE(1, o + 4);
  dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(e.size, o + 8);
  dir.writeUInt32LE(e.offset, o + 12);
});
writeFileSync(join(outDir, "icon.ico"), Buffer.concat([header, dir, ...datas]));

// ICNS: container chứa iconset PNG (macOS chấp nhận PNG trong icns từ 10.7+)
async function icnsEntry(type, size) {
  const data = await sharp(pngBuffers["icon.png"]).resize(size, size).png().toBuffer();
  const head = Buffer.alloc(8, 0);
  head.write(type, 0, "ascii");
  head.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([head, data]);
}
const icnsParts = [
  await icnsEntry("icp4", 16),
  await icnsEntry("icp5", 32),
  await icnsEntry("ic07", 128),
  await icnsEntry("ic08", 256),
];
const icnsBody = Buffer.concat(icnsParts);
const icnsHead = Buffer.alloc(8, 0);
icnsHead.write("icns", 0, "ascii");
icnsHead.writeUInt32BE(icnsBody.length + 8, 4);
writeFileSync(join(outDir, "icon.icns"), Buffer.concat([icnsHead, icnsBody]));

console.log(`[make-icons] OK → src-tauri/icons/ (nguồn: ${existsSync(source) ? ".freebuff/icon.png" : "SVG mặc định"})`);
