import { NextRequest, NextResponse } from "next/server";
import { cleanupOldNotifications } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedCount = await cleanupOldNotifications(30);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} old read notifications`,
    });
  } catch (error) {
    console.error("Cron job error (cleanup-notifications):", error);
    return NextResponse.json(
      { error: "Failed to cleanup notifications" },
      { status: 500 }
    );
  }
}
