#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy..."
npx --no-install prisma migrate deploy

echo "[entrypoint] starting server..."
exec "$@"
