#!/usr/bin/env node
/**
 * make-icons.mjs — sinh bộ icon Tauri + asset web từ logo nguồn:
 *   1. .freebuff/icon.png (nếu có) — logo do người dùng cung cấp
 *      (tự tách phần khiên khỏi wordmark: crop bounding-box + xoá nền trắng)
 *   2. SVG mặc định (chữ thập cứu trợ + chấm cảnh báo) nếu không có logo
 *
 * Xuất:
 *   - src-tauri/icons/: 32x32.png, 128x128.png, 128x128@2x.png, icon.png,
 *     icon.ico (Windows), icon.icns (macOS) — khiên trên tile bo góc
 *   - public/logo.png (512, nền trong suốt) — dùng trong UI web
 *   - src/app/icon.png (256) — favicon tự động của Next.js
 *   - src-tauri/splash/logo.png (128, nền trong suốt) — trang splash desktop
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const iconsDir = join(root, "src-tauri", "icons");
mkdirSync(iconsDir, { recursive: true });
mkdirSync(join(root, "public"), { recursive: true });

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("[make-icons] ERROR: sharp không khả dụng — hãy chạy `npm install` trước");
  process.exit(1);
}

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f2a43"/>
  <rect x="226" y="136" width="60" height="240" rx="14" fill="#e8f1f8"/>
  <rect x="136" y="226" width="240" height="60" rx="14" fill="#e8f1f8"/>
  <circle cx="396" cy="132" r="52" fill="#ff5a5a"/>
  <text x="396" y="156" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#ffffff" text-anchor="middle">!</text>
</svg>`;

const source = join(root, ".freebuff", "icon.png");
const hasSource = existsSync(source);

/** Tách phần khiên: crop bounding-box nội dung phía trên wordmark + xoá nền trắng.
 *  Logo nguồn thường qua JPEG nên có nhiễu quanh viền — khử nhiễu bằng median
 *  rồi dùng ngưỡng NHỊ PHÂN (gần-trắng → trong suốt), không alpha nửa vời để
 *  tránh đốm noise. Nội dung khiên trắng sẽ trở thành "knockout" trên tile. */
async function extractShield() {
  const denoised = await sharp(source).median(3).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = denoised;
  const { width, height, channels } = info;
  const isWhite = (x, y) => {
    const i = (y * width + x) * channels;
    return data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
  };
  // Hàng không-trắng đầu tiên (đỉnh khiên)
  let top = -1;
  for (let y = 0; y < height && top < 0; y++) {
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
      if (!isWhite(x, y)) { top = y; break; }
    }
  }
  if (top < 0) throw new Error("logo toàn trắng?");
  // Khoảng trắng dọc liên tục >=8 hàng sau vùng khiên → đáy khiên (trước wordmark)
  let gapStart = height;
  outer: for (let y = top + 100; y < height - 8; y++) {
    let allWhite = true;
    for (let x = 0; x < width; x++) if (!isWhite(x, y)) { allWhite = false; break; }
    if (allWhite) {
      for (let y2 = y; y2 < y + 8; y2++) {
        for (let x = 0; x < width; x++) if (!isWhite(x, y2)) continue outer;
      }
      gapStart = y;
      break outer;
    }
  }
  // Bounding box ngang của khiên
  let minX = width, maxX = 0;
  for (let y = top; y < gapStart; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWhite(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
  }
  const pad = 6;
  const left = Math.max(0, minX - pad);
  const topC = Math.max(0, top - pad);
  const w = Math.min(width, maxX + pad) - left;
  const h = gapStart - topC;
  // Hình vuông bao quanh (padding đều) rồi xoá nền trắng bằng ước lượng alpha
  const side = Math.max(w, h);
  const sqLeft = Math.max(0, Math.round(left + w / 2 - side / 2));
  const sqTop = Math.max(0, Math.round(topC + h / 2 - side / 2));
  const sq = Math.min(side, width - sqLeft, height - sqTop);

  const buf = await sharp(source)
    .extract({ left: sqLeft, top: sqTop, width: sq, height: sq })
    .median(3)
    .raw().toBuffer();
  const ch = 4;
  const out = Buffer.alloc(sq * sq * ch);
  for (let i = 0, o = 0; i < buf.length; i += channels, o += ch) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    // Ngưỡng nhị phân: gần-trắng/sáng trung tính → trong suốt hoàn toàn;
    // pixel màu (khiên, play, sóng) → đặc, giữ nguyên màu gốc.
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const transparent = min >= 205 && max - min < 60;
    out[o] = r; out[o + 1] = g; out[o + 2] = b;
    out[o + 3] = transparent ? 0 : 255;
  }
  // Dọn đốm rời rạc: majority filter 3x3 trên kênh alpha
  const cleaned = Buffer.from(out);
  for (let y = 1; y < sq - 1; y++) {
    for (let x = 1; x < sq - 1; x++) {
      const o = (y * sq + x) * ch;
      let opaqueNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (out[((y + dy) * sq + (x + dx)) * ch + 3] === 255) opaqueNeighbors++;
      }
      if (out[o + 3] === 255 && opaqueNeighbors <= 2) cleaned[o + 3] = 0;
      if (out[o + 3] === 0 && opaqueNeighbors >= 7) cleaned[o + 3] = 255;
    }
  }
  return sharp(cleaned, { raw: { width: sq, height: sq, channels: ch } }).png().toBuffer();
}

/** Khiên trong suốt (nguồn thật hoặc fallback SVG không nền). */
const shieldPng = hasSource
  ? await extractShield()
  : await sharp(Buffer.from(DEFAULT_SVG)).png().toBuffer();

/** Tile bo góc nền gradient (nhất quán với tile gradient-brand của UI). */
const TILE = 1024;
const tileSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">
     <defs>
       <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="#14395c"/>
         <stop offset="1" stop-color="#0a2136"/>
       </linearGradient>
     </defs>
     <rect width="${TILE}" height="${TILE}" rx="${Math.round(TILE * 0.225)}" fill="url(#g)"/>
   </svg>`,
);
const shieldOnTile = 660;
const shieldResized = await sharp(shieldPng).resize(shieldOnTile, shieldOnTile).png().toBuffer();
const tile = await sharp({ create: { width: TILE, height: TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: tileSvg, top: 0, left: 0 },
    { input: shieldResized, top: Math.round((TILE - shieldOnTile) / 2), left: Math.round((TILE - shieldOnTile) / 2) },
  ])
  .png().toBuffer();

// 1. Bộ PNG cho Tauri
const pngBuffers = {};
for (const [name, size] of [["32x32.png", 32], ["128x128.png", 128], ["128x128@2x.png", 256], ["icon.png", 512]]) {
  pngBuffers[name] = await sharp(tile).resize(size, size).png().toBuffer();
  writeFileSync(join(iconsDir, name), pngBuffers[name]);
}

// 2. ICO: nhúng 32/48/64 px
const icoSizes = [32, 48, 64];
const entries = [];
let offset = 6 + 16 * icoSizes.length;
const datas = [];
for (const s of icoSizes) {
  const data = await sharp(tile).resize(s, s).png().toBuffer();
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
writeFileSync(join(iconsDir, "icon.ico"), Buffer.concat([header, dir, ...datas]));

// 3. ICNS: container chứa iconset PNG (macOS chấp nhận PNG trong icns từ 10.7+)
async function icnsEntry(type, size) {
  const data = await sharp(tile).resize(size, size).png().toBuffer();
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
writeFileSync(join(iconsDir, "icon.icns"), Buffer.concat([icnsHead, icnsBody]));

// 4. Asset web: logo nền trong suốt cho UI + favicon của Next + logo cho splash desktop
writeFileSync(join(root, "public", "logo.png"), await sharp(shieldPng).resize(512, 512).png().toBuffer());
writeFileSync(join(root, "src", "app", "icon.png"), await sharp(tile).resize(256, 256).png().toBuffer());
mkdirSync(join(root, "src-tauri", "splash"), { recursive: true });
writeFileSync(join(root, "src-tauri", "splash", "logo.png"), await sharp(shieldPng).resize(128, 128).png().toBuffer());

console.log(`[make-icons] OK → src-tauri/icons/ + public/logo.png + src/app/icon.png (nguồn: ${hasSource ? "logo người dùng" : "SVG mặc định"})`);
