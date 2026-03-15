import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredIdempotencyKeys } from "@/lib/idempotency";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedCount = await cleanupExpiredIdempotencyKeys();

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} expired idempotency keys`,
    });
  } catch (error) {
    console.error("Cron job error (cleanup-idempotency):", error);
    return NextResponse.json(
      { error: "Failed to cleanup idempotency keys" },
      { status: 500 }
    );
  }
}
