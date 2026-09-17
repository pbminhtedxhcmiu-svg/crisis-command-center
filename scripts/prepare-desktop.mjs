#!/usr/bin/env node
/**
 * prepare-desktop.mjs — lắp runtime desktop cho Tauri
 *
 * Tạo src-tauri/binaries/ chứa:
 *   - app/        : Next standalone + .next/static + public + prisma/ (schema + migrations)
 *   - node/       : node runtime (sidecar) — node.exe (win) / node (unix)
 *   - prisma-cli/ : node_modules/prisma + @prisma + c12/pathe/kindof + .bin (cho migrate-on-boot)
 *
 * Cross-platform: dùng --target-apple-darwin khi build macOS trên Windows
 * (runtime macOS lấy từ biến DESKTOP_NODE_DIR do CI cung cấp).
 */
import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "src-tauri", "binaries");
const target = process.argv.find((a) => a.startsWith("--target")) ?? "";

const nodeDirRaw = process.env.DESKTOP_NODE_DIR ?? join(root, ".tools", "node-v22.14.0-win-x64");

function fail(msg) {
  console.error(`[prepare-desktop] ERROR: ${msg}`);
  process.exit(1);
}

function copyChecked(src, dest) {
  if (!existsSync(src)) fail(`không tìm thấy ${src}`);
  cpSync(src, dest, { recursive: true, verbatimSymlinks: false, force: true });
}

function assertSameSize(a, b) {
  const sa = statSync(a).size;
  const sb = statSync(b).size;
  if (sa !== sb) fail(`copy khác kích thước: ${a} (${sa}) vs ${b} (${sb})`);
}

// 1. Dựng lại thư mục binaries từ đầu
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 2. Next standalone bundle
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) fail("thiếu .next/standalone — hãy chạy `npm run build` trước");
const appDir = join(outDir, "app");
copyChecked(standalone, appDir);

// static + public + prisma (giống COPY của Dockerfile)
const staticDir = join(appDir, ".next", "static");
mkdirSync(staticDir, { recursive: true });
copyChecked(join(root, ".next", "static"), staticDir);
if (existsSync(join(root, "public"))) copyChecked(join(root, "public"), join(appDir, "public"));
copyChecked(join(root, "prisma"), join(appDir, "prisma"));

// bỏ .env đính theo standalone (bản phát hành không nhúng secret)
rmSync(join(appDir, ".env"), { force: true });

// 3. Node sidecar runtime (tên file phải là node-<target-triple>[.exe] theo quy ước Tauri)
const nodeDir = resolve(nodeDirRaw);
const nodeExeWin = join(nodeDir, "node.exe");
const nodeBinUnix = join(nodeDir, "bin", "node");
const triple = (target.replace("--target=", "") ||
  (process.platform === "win32"
    ? "x86_64-pc-windows-msvc"
    : process.arch === "arm64"
      ? "aarch64-apple-darwin"
      : "x86_64-apple-darwin"));
const sidecarName = `node-${triple}${triple.includes("windows") ? ".exe" : ""}`;
const sidecarDir = join(outDir, "node");
mkdirSync(sidecarDir, { recursive: true });
if (existsSync(nodeExeWin)) {
  copyFileSync(nodeExeWin, join(sidecarDir, sidecarName));
  assertSameSize(nodeExeWin, join(sidecarDir, sidecarName));
} else if (existsSync(nodeBinUnix)) {
  copyFileSync(nodeBinUnix, join(sidecarDir, sidecarName));
  assertSameSize(nodeBinUnix, join(sidecarDir, sidecarName));
} else {
  fail(`không tìm thấy node runtime trong ${nodeDir} (đặt DESKTOP_NODE_DIR để chỉ đường dẫn)`);
}

// 4. Prisma CLI closure: cài THẬT bằng npm vào thư mục riêng — npm tự resolve toàn bộ
// dependency bắc cầu (c12/effect/jiti/...) + tải đúng engine cho nền tảng build
const cliDir = join(outDir, "prisma-cli");
mkdirSync(cliDir, { recursive: true });
writeFileSync(
  join(cliDir, "package.json"),
  JSON.stringify({ name: "ccc-prisma-cli", private: true, dependencies: { prisma: "^6.5.0" } }, null, 2),
);
const { execSync } = await import("node:child_process");
execSync("npm install --omit=dev --no-audit --no-fund", { cwd: cliDir, stdio: "inherit" });
if (!existsSync(join(cliDir, "node_modules", "prisma", "build", "index.js"))) {
  fail("cài prisma-cli thất bại — thiếu node_modules/prisma/build/index.js");
}

// 5. Hợp lệ hoá cuối
for (const p of [
  join(appDir, "server.js"),
  join(appDir, "prisma", "schema.prisma"),
  join(appDir, "prisma", "migrations"),
  join(outDir, "prisma-cli", "node_modules", "prisma", "build", "index.js"),
]) {
  if (!existsSync(p)) fail(`bundle thiếu ${p}`);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  target: target.replace("--target=", "") || "current",
  nodeSource: nodeDir,
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`[prepare-desktop] OK → src-tauri/binaries/ (target=${manifest.target})`);
