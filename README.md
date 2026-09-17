[![Release CI](https://github.com/pbminhtedxhcmiu-svg/crisis-command-center/actions/workflows/release.yml/badge.svg)](https://github.com/pbminhtedxhcmiu-svg/crisis-command-center/actions/workflows/release.yml)

# ⛑ Crisis Command Center v1.0.0

Nền tảng giám sát & xử lý khủng hoảng cho livestream bán hàng — **hỗ trợ nhiều ngành hàng** (mỹ phẩm, thực phẩm, TPCN, thời trang, điện tử, gia dụng, mẹ & bé…).

- **Phát hiện**: phân loại bình luận realtime (giá/ship/giao hàng/claim/spam) → signal → alert có ưu tiên P0–P3 theo policy rules.
- **Xử lý**: alert → incident có SLA, phân công, escalate, evidence, timeline, audit log đầy đủ.
- **Phản hồi**: Response Studio với template theo ngành hàng, chặn claim cấm, luồng duyệt (Legal/Lead) — không tự đăng công khai.

## Cài đặt & chạy (Node 20/22)

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start            # http://localhost:3000
```

Dữ liệu demo (10 vai trò @nova.demo / mật khẩu `crisis2026`):

```bash
npm run db:seed
```

## Chạy bằng Docker

```bash
docker build -t crisis-command-center:1.0.0 .
docker run -p 3000:3000 -v ccc-data:/app/data \
  -e DATABASE_URL="file:/app/data/prod.db" \
  crisis-command-center:1.0.0
curl http://localhost:3000/api/health   # {"status":"ok",...}
```

## Kiểm thử

```bash
npm run typecheck
npm test                 # 77 unit + 24 integration
npm run lint
node tests/api-smoke.mjs http://localhost:3000   # 46 assertions qua HTTP thật
```

## Phát hành & CI

Mỗi lần push tag `v*` (hoặc chạy tay từ tab Actions), workflow GitHub Actions sẽ tự động:

1. **Kiểm thử toàn diện** — typecheck, lint, 101 unit + integration tests, build production, smoke test 46 assertions trên server thật
2. **Build Docker image** — chạy container, seed DB, verify `/api/health` và smoke test ngay trong container
3. **Đính artifact** — image nén `crisis-command-center-image.tar.gz` được tải lên GitHub Release của tag (`docker load < crisis-command-center-image.tar.gz` để dùng)

## Đa ngành hàng hoạt động thế nào?

Khi tạo event, mỗi mặt hàng chọn 1 **ngành hàng**. Hệ thống tự dùng bộ từ khoá nghi vấn đặc thù ngành (VD: mỹ phẩm → "trộn corticoid", điện tử → "nổ pin", thực phẩm → "hết date") để phân loại claim và sinh cảnh báo phù hợp — không cần cấu hình thêm. Xem `src/lib/crisis/categories.ts` để thêm ngành mới.

Chi tiết kỹ thuật: [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md).
