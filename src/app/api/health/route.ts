import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";
import { NextResponse } from "next/server";

// Health check cho reverse proxy / container orchestrator.
// Trả 200 khi app + DB sẵn sàng; 503 khi DB down (không leak chi tiết lỗi ra ngoài).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({
      status: "ok",
      service: "crisis-command-center",
      version: process.env.APP_VERSION ?? "1.0.0",
      database: "up",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "down", time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
