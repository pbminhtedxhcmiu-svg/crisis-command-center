# Run doc — Crisis Command Center / LiveGuard v1.1.2 (+ tính năng local: playbook, escalation 4 mức, connector comment thật)

Repo gốc: https://github.com/pbminhtedxhcmiu-svg/crisis-command-center (local đã sync = v1.1.2, commit b6c137a).

## 1. Tái tạo artifacts

1. **Node**: máy không có Node trong PATH — dùng bản portable trong `.tools/node-v22.14.0-win-x64/`.
   Mọi shell phải thêm vào PATH trước: `.tools/node-v22.14.0-win-x64`.
2. **Env**: `.env` đã có sẵn ở local (chứa `DATABASE_URL="file:./dev.db?connection_limit=1&socket_timeout=15"`).
   Nếu thiếu: copy `.env.example` → `.env` và set `APP_VERSION="1.1.2"`. `.env` không nằm trong git — KHÔNG commit.
3. **Dependencies**: `npm install` (hoặc `npm ci`).
   ⚠️ Thư mục này nằm trong OneDrive — nếu npm lỗi `UNKNOWN unlink/mkdir` trong `node_modules`, đợi sync xong rồi chạy lại.
   Đã biết: `node_modules/.effect-BROKEN-do-not-delete` là placeholder OneDrive hỏng, không xóa được, vô hại — đừng đụng vào.
4. **DB**: `npx prisma migrate deploy && npx prisma generate` (tạo `prisma/dev.db` theo schema v1.1.2).
5. **Dữ liệu demo**: `npm run db:seed` → 10 tài khoản `@nova.demo`, mật khẩu `crisis2026` (login: `owner@nova.demo`).
   ⚠️ CẢNH BÁO: `npm test` (integration) sẽ XOÁ SẠCH dữ liệu của `dev.db` vì test đọc `DATABASE_URL` từ `.env`.
   Sau khi chạy test, phải `npm run db:seed` lại. Test chuẩn phải chạy với `test.db` (xem `.env.test`).
6. DB cũ của bản 0.1.0 đã backup tại `prisma/dev.db.old-0.1.0.bak` và `prisma/test.db.old-0.1.0.bak`;
   backup toàn bộ code 0.1.0 tại `C:\Users\Admin\AppData\Local\Temp\ccc-backup\backup-0.1.0.tgz`.

## 2. Chạy server

- Script: `npm run dev` → Next.js 15 trên **port 3000** (mặc định, đang free).
- Chạy detached (PowerShell, thêm thư mục Node portable vào PATH của process con):
  ```
  powershell -NoProfile -Command "$env:PATH='<đường dẫn tuyệt đối>\.tools\node-v22.14.0-win-x64;'+$env:PATH; (Start-Process -FilePath '<đường dẫn tuyệt đối>\.tools\node-v22.14.0-win-x64\npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory '<thư mục dự án>' -RedirectStandardOutput '<log>.log' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  (bash phải escape `$env` thành `\$env`; stdout/stderr phải là 2 file khác nhau; khởi động mất ~15–20s.)
- Health check: `curl http://localhost:3000/api/health` → `{"status":"ok","version":"1.1.2","database":"up"}`.
  Request đầu tiên sau khi `Ready` có thể timeout do compile — thử lại với timeout dài.
- Đăng nhập UI: `/login` → `owner@nova.demo` / `crisis2026` (prefill sẵn ở dev).

## 3. Connector comment thật (kết nối livestream thật)

Event phải **LIVE + dataMode = LIVE** (DEMO thì dùng simulator). Trong Command Center bấm **🔌 Nguồn comment thật**:
- **TikTok**: điền `@username` hoặc link `tiktok.com/@username/live` (hoặc để trống — lấy từ Linkstream). Kênh phải đang live thật; lỗi `Failed to retrieve Room ID` = kênh không live hoặc username sai. Dùng thư viện `tiktok-live-connector` (unofficial — TikTok có thể đổi API bất cứ lúc nào).
- **Facebook**: cần **Page Access Token** (tạo trong developers.facebook.com → app → Permissions: `pages_read_engagement`, `pages_manage_metadata`) + videoId live (`facebook.com/watch/?v=<id>`). Token KHÔNG được lưu DB — chỉ dùng phiên.
- Comment thật đi vào cùng pipeline phân loại → signal → alert → escalation như simulator.

## 4. Tính năng local chưa có trên GitHub (nhớ khi release)

- Playbook 'Rủi ro phát ngôn host/KOL' + checklist trước live + riskKeywords bơm classifier (risk type `host_statement`, base score 6, ngưỡng alert = 1 comment)
- Escalation banner 4 mức độ (Minor/Moderate/Severe/Critical) tự tính từ alerts/incidents — `src/lib/crisis/escalation.ts`
- Connector TikTok/Facebook — `src/lib/crisis/connector.ts` + `POST /api/live-events/:id/connect`
- Migrations: `20260919160000_playbook_checklist_risk_keywords`, `20260919161000_drop_playbook_checklist_json`
