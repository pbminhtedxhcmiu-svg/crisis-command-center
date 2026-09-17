# ---------- deps ----------
FROM node:22-alpine AS deps
# Prisma engine trên Alpine (musl) cần libc6-compat + openssl
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Generate Prisma client trước để layer cache tốt
RUN npm ci && npx prisma generate

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./build-placeholder.db"
# Build không cần DB thật (page dùng force-dynamic)
RUN npm run build

# ---------- runner ----------
FROM node:22-alpine AS runner
# Engine của Prisma (query + schema) cần libssl/compat trên Alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Prisma CLI cần cho migrate deploy lúc khởi động
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/prisma ./prisma
# Prisma là production dependency → npm ci --omit=dev tạo closure đầy đủ cho CLI
# (không copy thủ công — tránh ERR_MODULE_NOT_FOUND do thiếu dep bắc cầu)
# và generate đúng engine linux-musl cho image (client copy từ builder là bản Windows)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=builder --chown=app:app /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh
# DB SQLite nằm trong /app/data — mount volume vào đây
RUN mkdir -p /app/data && chown -R app:app /app/data
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
