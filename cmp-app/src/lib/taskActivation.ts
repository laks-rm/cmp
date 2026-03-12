import { prisma } from "./prisma";
import { logAuditEvent } from "./audit";
import { addDays } from "date-fns";

let lastActivationCheck: Date | null = null;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export async function activatePlannedTasks(userId?: string): Promise<number> {
  const now = new Date();
  
  // Check if we ran this recently
  if (lastActivationCheck && (now.getTime() - lastActivationCheck.getTime()) < CHECK_INTERVAL_MS) {
    return 0;
  }

  lastActivationCheck = now;

  try {
    // Find all PLANNED tasks where plannedDate is within the next 7 days
    const sevenDaysFromNow = addDays(now, 7);

    const tasksToActivate = await prisma.task.findMany({
      where: {
        status: "PLANNED",
        plannedDate: {
          lte: sevenDaysFromNow,
        },
      },
      select: {
        id: true,
        name: true,
        entityId: true,
        plannedDate: true,
      },
    });

    if (tasksToActivate.length === 0) {
      return 0;
    }

    // Update all found tasks to TO_DO status
    await prisma.task.updateMany({
      where: {
        id: {
          in: tasksToActivate.map((t) => t.id),
        },
      },
      data: {
        status: "TO_DO",
      },
    });

    // Log audit entries for each activation
    for (const task of tasksToActivate) {
      await logAuditEvent({
        action: "TASK_AUTO_ACTIVATED",
        module: "TASKS",
        userId: userId || "system",
        entityId: task.entityId,
        targetType: "Task",
        targetId: task.id,
        details: {
          plannedDate: task.plannedDate,
          activatedAt: now,
        },
      });
    }

    return tasksToActivate.length;
  } catch (error) {
    console.error("Error activating planned tasks:", error);
    return 0;
  }
}
