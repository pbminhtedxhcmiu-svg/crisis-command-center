# IMPLEMENTATION_NOTES — Livestream Crisis Command Center v1.0.0

> **Bản chính thức phát hành 1.0.0** — Next.js 15 (App Router) + TypeScript + Prisma/SQLite + Tailwind CSS v4 + Vitest.
> Mục tiêu bản 1.0: phát hành/deploy được ngay trên nhiều nền tảng (Node, Docker), **hỗ trợ nhiều ngành hàng khác nhau**, ít sai số nhất.

## 1. Kiến trúc

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components cho pages, Route Handlers cho API |
| DB | SQLite qua Prisma | `prisma/dev.db` (dev) + `prisma/test.db` (integration) |
| Auth | Session cookie `ccc_session` + scrypt (node:crypto) | Không native deps; demo prefill chỉ hiện ở dev |
| RBAC | Ma trận permission `src/lib/rbac.ts` | Backend enforce `requirePermission`, frontend ẩn/disable |
| Validation | Zod ở mọi mutation endpoint | Lỗi format thống nhất `src/lib/errors.ts` + `src/lib/http.ts` |
| Realtime | Polling 3s `/api/live-events/:id/stream` | TODO chuyển SSE/WebSocket |
| Simulator | `DemoStreamSimulator` in-process | Tick 1s, kịch bản sinh theo ngành hàng của event |
| Tests | Vitest 77 unit + 24 integration + 46 smoke HTTP | Xem mục 6 |

### Nhánh MT (message → signal → alert)
- **Message** → **Signal** (rule-based `RuleBasedClassifier`, có thể thay bằng AI giữ nguyên interface) → **Alert** (policy rules: burst delivery, product_claim, spam, volume_spike).

## 2. MỚI TRONG 1.0.0 — Hỗ trợ đa ngành hàng

- `PRODUCT_CATEGORIES` (`src/lib/constants.ts`): `cosmetics | food | supplement | fashion | electronics | home | mother_baby | other`.
- `src/lib/crisis/categories.ts`: meta theo ngành — `claimDoubts` (nghi vấn đặc thù), `claimBenefits`, `authority`. Thêm ngành hàng mới = thêm 1 key ở đây, mọi pipeline tự nhận.
- Classifier: với event có `products[].category`, rule `product_claim` tự cộng thêm claimDoubts của ngành → bắt được "trộn corticoid" (mỹ phẩm), "nổ pin" (điện tử), "hết date" (F&B)… Không truyền category → hành vi cũ giữ nguyên (backward compatible).
- Simulator: kịch bản demo sinh từ `buildScript(category, productHint)` — nội dung nghi vấn claim theo ngành + tên sản phẩm thật của event.
- API `POST /api/live-events` validate `products[].category` bằng Zod (category lạ → 422). `PATCH` cũng nhận category.
- Form tạo event: mỗi mặt hàng 1 dòng (tên + offer + ngành hàng), thêm/xoá dòng tuỳ ý.

## 3. MỚI TRONG 1.0.0 — Production readiness

- `next.config.ts`: `output: "standalone"` (image nhỏ), `poweredByHeader: false`, security headers cho mọi route:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, và **CSP** (`script-src 'self' 'unsafe-inline'`, chỉ dev mới có `unsafe-eval`; `frame-ancestors 'none'`).
- `GET /api/health` — health check cho reverse proxy/orchestrator: 200 khi DB up (kèm version), **503 khi DB down** (không leak chi tiết lỗi).
- `Dockerfile` multi-stage (deps → builder → runner, node:22-alpine, **user non-root**, `HEALTHCHECK` gọi `/api/health`) + `docker-entrypoint.sh` chạy `prisma migrate deploy` trước khi start; SQLite mount tại `/app/data` (set `DATABASE_URL="file:/app/data/prod.db"`).
- `.env.example` — mẫu env cho người tải bản phát hành (ưu tiên thêm `AUTH_SECRET` khi Next hỗ trợ dùng cho ký cookie; hiện session token đã random 24-byte/user).
- `package.json` v1.0.0: thêm `start:migrate`, `db:deploy`, `prisma:generate`.
- Login page: prefill tài khoản demo chỉ ở dev, production không lộ.
- Sửa lỗi: `firstResponseTime` trước đây trả giá trị sai (đo timestamp tuyệt đối thay vì khoảng cách); NewEventForm redirect sai (`body.event.id` → `body.id`); `GET/PATCH /api/live-events/[id]` trả raw 500 cho not-found → giờ trả error format thống nhất 404.

## 4. Quy ước giữ nguyên từ MVP

1. Data mode DEMO/LIVE: LIVE connector chưa có, simulator là nguồn DEMO duy nhất, mọi màn hình gắn nhãn DEMO.
2. Incident severity = alert priority trong MVP (2 cột schema để tách sau).
3. Publish response công khai cố tình KHÔNG triển khai — draft dừng ở APPROVED.
4. SQLite URL có `connection_limit=1&socket_timeout=15` chống BUSY lock.
5. Idempotency `requestKey` cho mọi mutation quan trọng; audit log không bao giờ ghi secret; PII author mask ở stream API.

## 5. Cách phát hành / chạy

### Node trực tiếp
```bash
npm ci && npx prisma migrate deploy
node prisma/seed.mjs        # (tuỳ chọn) dữ liệu demo
npm run build && npm start  # hoặc npm run start:migrate
```

### Docker
```bash
docker build -t crisis-command-center:1.0.0 .
docker run -p 3000:3000 -v ccc-data:/app/data \
  -e DATABASE_URL="file:/app/data/prod.db" \
  crisis-command-center:1.0.0
# Health: curl http://localhost:3000/api/health
```

## 6. Validation đã chạy (kết quả thật, 2026-09-17)

| Lệnh | Kết quả |
|---|---|
| `tsc --noEmit` | ✅ 0 error |
| `eslint src --ext .ts,.tsx` | ✅ 0 error |
| `vitest run tests/unit` | ✅ 77/77 (thêm `tests/unit/categories.test.ts`) |
| `vitest run tests/integration` (test.db) | ✅ 24/24 |
| `next build` | ✅ thành công, output standalone |
| `node tests/api-smoke.mjs http://localhost:3458` (next start thật) | ✅ 46/46 (thêm health + multi-category + category 422) |
| Security headers qua curl | ✅ đủ 5 header, không có X-Powered-By |

## 7. Limitations / chưa có (cho 1.x tiếp theo)

- Không WebSocket/SSE — polling 3s.
- Connector LIVE thật (Facebook/TikTok/Shopee API) — interface simulator đã sẵn sàng để thay.
- Không export report PDF/CSV; chưa có notification center; không upload evidence file.
- Simulator in-process — restart server mất timer (tự recover về PAUSED, không crash).
- `AUTH_SECRET` chưa được dùng ký cookie (session token tự random đủ mạnh); cân nhắc xoay session khi thêm.

## 8. Kế hoạch phase tiếp theo

- Phase 3: chỉnh template trực tiếp trong Response Studio, versioning draft, escalation rule theo giờ.
- Phase 4: export report (PDF/CSV), so sánh nhiều event, timeline theo phút.
- Phase 5: SSE/WebSocket, e2e Playwright, permission audit tự động, reconnect backoff.
- Connector thật: implement cùng interface `start/pause/resume/stop` + ingest message → frontend không đổi.
