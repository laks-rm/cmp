import { NextRequest, NextResponse } from "next/server";
import { generateRollingTasks } from "@/lib/taskActivation";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasksCreated = await generateRollingTasks();

    return NextResponse.json({
      success: true,
      tasksCreated,
      message: `Generated ${tasksCreated} rolling tasks`,
    });
  } catch (error) {
    console.error("Cron job error (generate-rolling-tasks):", error);
    return NextResponse.json(
      { error: "Failed to generate rolling tasks" },
      { status: 500 }
    );
  }
}
