import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { addDays } from "date-fns";

let lastActivationCheck: Date | null = null;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let lastRollingTaskCheck: Date | null = null;
const ROLLING_TASK_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
          in: tasksToActivate.map((t: { id: string }) => t.id),
        },
      },
      data: {
        status: "TO_DO",
      },
    });

    // Log audit entries for all activations in a single batch
    const auditUserId = userId || "system";
    await prisma.auditLog.createMany({
      data: tasksToActivate.map((task: { id: string; name: string; entityId: string; plannedDate: Date | null }) => ({
        action: "TASK_AUTO_ACTIVATED",
        module: "TASKS",
        userId: auditUserId,
        entityId: task.entityId,
        targetType: "Task",
        targetId: task.id,
        details: {
          plannedDate: task.plannedDate,
          activatedAt: now,
        },
        createdAt: now,
      })),
    });

    return tasksToActivate.length;
  } catch (error) {
    console.error("Error activating planned tasks:", error);
    return 0;
  }
}

export async function generateRollingTasks(): Promise<number> {
  const now = new Date();
  
  // Check if we ran this recently
  if (lastRollingTaskCheck && (now.getTime() - lastRollingTaskCheck.getTime()) < ROLLING_TASK_CHECK_INTERVAL_MS) {
    return 0;
  }

  lastRollingTaskCheck = now;

  try {
    let tasksCreated = 0;

    // Find all DAILY and WEEKLY frequency tasks that need rolling generation
    const rollingFrequencyTasks = await prisma.task.findMany({
      where: {
        frequency: {
          in: ["DAILY", "WEEKLY"],
        },
        recurrenceGroupId: {
          not: null,
        },
      },
      select: {
        id: true,
        sourceId: true,
        sourceItemId: true,
        name: true,
        description: true,
        expectedOutcome: true,
        entityId: true,
        frequency: true,
        quarter: true,
        riskRating: true,
        assigneeId: true,
        responsibleTeamId: true,
        picId: true,
        reviewerId: true,
        startDate: true,
        testingPeriodStart: true,
        testingPeriodEnd: true,
        evidenceRequired: true,
        narrativeRequired: true,
        reviewRequired: true,
        clickupUrl: true,
        gdriveUrl: true,
        recurrenceGroupId: true,
      },
      distinct: ["recurrenceGroupId"],
    });

    if (rollingFrequencyTasks.length === 0) {
      return 0;
    }

    const thirtyDaysOut = addDays(now, 30);

    for (const templateTask of rollingFrequencyTasks) {
      // Find the latest task in this recurrence group
      const latestTask = await prisma.task.findFirst({
        where: {
          recurrenceGroupId: templateTask.recurrenceGroupId,
        },
        orderBy: {
          plannedDate: "desc",
        },
        select: {
          plannedDate: true,
          recurrenceIndex: true,
        },
      });

      if (!latestTask || !latestTask.plannedDate) {
        continue;
      }

      // Check if we need to generate more tasks
      if (latestTask.plannedDate >= thirtyDaysOut) {
        continue;
      }

      // Generate tasks up to 30 days out
      const dayIncrement = templateTask.frequency === "DAILY" ? 1 : 7;
      let nextDate = addDays(latestTask.plannedDate, dayIncrement);
      let nextIndex = (latestTask.recurrenceIndex || 0) + 1;

      const tasksToCreate = [];

      while (nextDate <= thirtyDaysOut) {
        const month = nextDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;

        tasksToCreate.push({
          sourceId: templateTask.sourceId,
          sourceItemId: templateTask.sourceItemId,
          name: templateTask.name,
          description: templateTask.description,
          expectedOutcome: templateTask.expectedOutcome,
          entityId: templateTask.entityId,
          frequency: templateTask.frequency,
          quarter,
          riskRating: templateTask.riskRating,
          assigneeId: templateTask.assigneeId,
          responsibleTeamId: templateTask.responsibleTeamId,
          picId: templateTask.picId,
          reviewerId: templateTask.reviewerId,
          startDate: templateTask.startDate,
          dueDate: nextDate,
          plannedDate: nextDate,
          testingPeriodStart: templateTask.testingPeriodStart,
          testingPeriodEnd: templateTask.testingPeriodEnd,
          evidenceRequired: templateTask.evidenceRequired,
          narrativeRequired: templateTask.narrativeRequired,
          reviewRequired: templateTask.reviewRequired,
          clickupUrl: templateTask.clickupUrl,
          gdriveUrl: templateTask.gdriveUrl,
          recurrenceGroupId: templateTask.recurrenceGroupId,
          recurrenceIndex: nextIndex,
          recurrenceTotalCount: null,
          status: "PLANNED",
        });

        nextDate = addDays(nextDate, dayIncrement);
        nextIndex++;
      }

      if (tasksToCreate.length > 0) {
        await prisma.task.createMany({
          data: tasksToCreate as Prisma.TaskCreateManyInput[],
        });
        tasksCreated += tasksToCreate.length;
      }
    }

    if (tasksCreated > 0) {
      console.log(`Generated ${tasksCreated} rolling tasks for DAILY/WEEKLY frequencies`);
    }

    return tasksCreated;
  } catch (error) {
    console.error("Error generating rolling tasks:", error);
    return 0;
  }
}
