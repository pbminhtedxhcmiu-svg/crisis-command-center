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

## Đa ngành hàng hoạt động thế nào?

Khi tạo event, mỗi mặt hàng chọn 1 **ngành hàng**. Hệ thống tự dùng bộ từ khoá nghi vấn đặc thù ngành (VD: mỹ phẩm → "trộn corticoid", điện tử → "nổ pin", thực phẩm → "hết date") để phân loại claim và sinh cảnh báo phù hợp — không cần cấu hình thêm. Xem `src/lib/crisis/categories.ts` để thêm ngành mới.

Chi tiết kỹ thuật: [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md).
