#!/bin/sh
set -e

# Prisma CLI có thể nằm ở node_modules (Docker: npm ci --omit=dev)
# hoặc prisma-cli/node_modules (desktop bundle do prepare-desktop.mjs lắp)
if [ -f prisma-cli/node_modules/prisma/build/index.js ]; then
  PRISMA="node prisma-cli/node_modules/prisma/build/index.js"
elif [ -f node_modules/prisma/build/index.js ]; then
  PRISMA="npx --no-install prisma"
else
  echo "[entrypoint] WARN: không tìm thấy Prisma CLI — bỏ qua migrate (DB phải sẵn sàng trước)"
  PRISMA=""
fi

if [ -n "$PRISMA" ]; then
  echo "[entrypoint] prisma migrate deploy..."
  $PRISMA migrate deploy
fi

echo "[entrypoint] starting server..."
exec "$@"
