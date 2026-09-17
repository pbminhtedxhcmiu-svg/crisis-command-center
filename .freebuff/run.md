# Run — Livestream Crisis Command Center

Next.js 15 (App Router) + Prisma/SQLite + Node portable trong `.tools/`.

## 1. Reproduce artifacts

```bash
# Node portable (PATH)
. ./.tools/env.sh

# Dependencies (node_modules đã có; chỉ chạy lại nếu thiếu)
npm install --no-audit --no-fund

# Prisma client
node node_modules/prisma/build/index.js generate

# Database (SQLite) + seed
node node_modules/prisma/build/index.js migrate deploy
node prisma/seed.mjs
```

Artifacts cần có: `.next/` (production build) — tạo bằng:

```bash
node node_modules/next/dist/bin/next build
```

## 2. Run server

Production (LAN, port 3000):

```bash
. ./.tools/env.sh
node node_modules/next/dist/bin/next start -p 3000
# bind 0.0.0.0 mặc định — truy cập LAN: http://<LAN-IP>:3000 (hiện tại 192.168.0.116:3000)
```

Dev mode (port khác để tránh đụng 3000):

```bash
node node_modules/next/dist/bin/next dev -p 3457
```

Detach (PowerShell, stdout/stderr phải khác file):

```powershell
$p = Start-Process -FilePath 'C:\Users\Admin\Desktop\Crisis management\.tools\node-v22.14.0-win-x64\node.exe' -ArgumentList 'node_modules/next/dist/bin/next','start','-p','3000' -WorkingDirectory 'C:\Users\Admin\Desktop\Crisis management' -RedirectStandardOutput 'C:\Users\Admin\Desktop\Crisis management\.freebuff\lan-3000.log' -RedirectStandardError 'C:\Users\Admin\Desktop\Crisis management\.freebuff\lan-3000.err.log' -WindowStyle Hidden -PassThru; $p.Id
```

Firewall rule (đã tạo): `netsh advfirewall firewall add rule name="Crisis Command Center 3000" dir=in action=allow protocol=TCP localport=3000`

## 3. Env

- `.env`: `DATABASE_URL="file:./prisma/dev.db"` (Prisma resolve tương đối từ thư mục `prisma/`)

## 4. Demo accounts

Mật khẩu chung `crisis2026` — `owner@nova.demo`, `crisis_lead@nova.demo`, `moderator@nova.demo`, `exec_viewer@nova.demo`, … (10 vai trò `@nova.demo`).

## 5. Validate

```bash
node node_modules/typescript/bin/tsc --noEmit          # typecheck
node node_modules/eslint/bin/eslint.js "src/**/*.ts" "src/**/*.tsx"
node node_modules/vitest/vitest.mjs run tests/unit     # 70 tests
DATABASE_URL="file:./test.db" node node_modules/vitest/vitest.mjs run tests/integration  # 24 tests
node tests/api-smoke.mjs http://localhost:3000         # 43 assertion qua HTTP thật
```
