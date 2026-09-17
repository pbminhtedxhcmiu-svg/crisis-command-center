import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError, validationError } from "@/lib/errors";

// Chuẩn response/error thống nhất mọi route
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ", details: error.flatten() } },
      { status: 422 },
    );
  }
  console.error("[api] unhandled:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Lỗi máy chủ không xác định" } },
    { status: 500 },
  );
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      throw validationError("Dữ liệu gửi lên không hợp lệ", e.flatten());
    }
    throw e;
  }
}

// ---- Rate limiting in-memory (per-IP, cửa sổ trượt đơn giản) ----
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: NextRequest, key: string, max = 120, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(bucketKey);
  if (!b || b.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > max) {
    throw new ApiError("RATE_LIMITED", "Quá nhiều yêu cầu, thử lại sau ít phút", 429);
  }
}

// ---- Idempotency: requestKey trùng trong TTL → trả kết quả đã ghi ----
const idem = new Map<string, { at: number; result: unknown }>();

export function idempotent<T>(requestKey: string | undefined | null, fn: () => Promise<T>): Promise<T> {
  if (!requestKey) return fn();
  const hit = idem.get(requestKey);
  if (hit && Date.now() - hit.at < 5 * 60_000) {
    return Promise.resolve(hit.result as T);
  }
  return fn().then((result) => {
    idem.set(requestKey, { at: Date.now(), result });
    if (idem.size > 500) {
      const cutoff = Date.now() - 5 * 60_000;
      for (const [k, v] of idem) if (v.at < cutoff) idem.delete(k);
    }
    return result;
  });
}
