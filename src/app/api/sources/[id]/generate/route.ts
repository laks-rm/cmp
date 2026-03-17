import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { bulkGenerateTasksSchema } from "@/lib/validations/sources";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { addDays } from "date-fns";
import { acquireConcurrentSlot, createConcurrentLimitResponse } from "@/lib/concurrentLimit";
import { shouldActivateTask } from "@/lib/taskActivation";

type RecurrenceInstance = {
  index: number;
  totalCount: number | null;
  plannedDate: Date;
  quarter: string | null;
};

/**
 * Calculate recurrence instances starting from the user-entered due date.
 * The baseDueDate is treated as the FIRST instance and recurrence anchor.
 * No backdated instances are generated.
 * 
 * @param frequency - Task frequency (MONTHLY, QUARTERLY, etc.)
 * @param baseDueDate - User-entered due date (becomes first instance)
 * @param sourceEffectiveDate - Source effective date (lower bound)
 * @returns Array of recurrence instances
 */
function calculateRecurrenceInstances(
  frequency: string,
  baseDueDate: Date | null,
  sourceEffectiveDate: Date | null = null
): RecurrenceInstance[] {
  const now = new Date();
  const instances: RecurrenceInstance[] = [];

  // Determine the anchor date (first instance)
  // Must be on or after source effective date
  let anchorDate: Date;
  if (baseDueDate) {
    anchorDate = new Date(baseDueDate);
  } else {
    // No due date provided - use source effective date or current date
    anchorDate = sourceEffectiveDate ? new Date(sourceEffectiveDate) : now;
  }

  // Enforce source effective date as lower bound
  if (sourceEffectiveDate) {
    const effectiveDate = new Date(sourceEffectiveDate);
    if (anchorDate < effectiveDate) {
      anchorDate = effectiveDate;
    }
  }

  switch (frequency) {
    case "ADHOC": {
      // Ad-hoc tasks are created as needed, no automatic recurrence
      instances.push({
        index: 1,
        totalCount: 1,
        plannedDate: anchorDate,
        quarter: null,
      });
      break;
    }

    case "ONE_TIME": {
      instances.push({
        index: 1,
        totalCount: 1,
        plannedDate: anchorDate,
        quarter: null,
      });
      break;
    }

    case "ANNUAL": {
      // Generate 3 years of annual tasks
      for (let year = 0; year < 3; year++) {
        const instanceDate = addYears(anchorDate, year);
        instances.push({
          index: year + 1,
          totalCount: 3,
          plannedDate: instanceDate,
          quarter: null,
        });
      }
      break;
    }

    case "BIENNIAL": {
      // Generate 3 biennial tasks (6 years total)
      for (let i = 0; i < 3; i++) {
        const instanceDate = addYears(anchorDate, i * 2);
        instances.push({
          index: i + 1,
          totalCount: 3,
          plannedDate: instanceDate,
          quarter: null,
        });
      }
      break;
    }

    case "SEMI_ANNUAL": {
      // Generate 2 years of semi-annual tasks (4 instances)
      for (let i = 0; i < 4; i++) {
        const instanceDate = addMonths(anchorDate, i * 6);
        const month = instanceDate.getMonth();
        const halfYear = month < 6 ? "H1" : "H2";
        instances.push({
          index: i + 1,
          totalCount: 4,
          plannedDate: instanceDate,
          quarter: halfYear,
        });
      }
      break;
    }

    case "QUARTERLY": {
      // Generate 2 years of quarterly tasks (8 instances)
      const anchorDay = anchorDate.getDate();
      
      for (let i = 0; i < 8; i++) {
        // Add 3 months per instance
        let instanceDate = addMonths(anchorDate, i * 3);
        
        // Preserve day-of-month where possible
        // If target month doesn't have anchor day, use last day of month
        const targetMonth = instanceDate.getMonth();
        const targetYear = instanceDate.getFullYear();
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        
        if (anchorDay > lastDayOfTargetMonth) {
          // Anchor day doesn't exist in target month (e.g., 31 in Feb)
          instanceDate = new Date(targetYear, targetMonth, lastDayOfTargetMonth);
        } else {
          // Use anchor day
          instanceDate = new Date(targetYear, targetMonth, anchorDay);
        }
        
        const month = instanceDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        
        instances.push({
          index: i + 1,
          totalCount: 8,
          plannedDate: instanceDate,
          quarter,
        });
      }
      break;
    }

    case "MONTHLY": {
      // Generate 18 months of tasks
      const anchorDay = anchorDate.getDate();
      
      for (let i = 0; i < 18; i++) {
        // Add i months to anchor
        let instanceDate = addMonths(anchorDate, i);
        
        // Preserve day-of-month where possible
        // If target month doesn't have anchor day, use last day of month
        const targetMonth = instanceDate.getMonth();
        const targetYear = instanceDate.getFullYear();
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        
        if (anchorDay > lastDayOfTargetMonth) {
          // Anchor day doesn't exist in target month (e.g., 31 in Feb)
          instanceDate = new Date(targetYear, targetMonth, lastDayOfTargetMonth);
        } else {
          // Use anchor day
          instanceDate = new Date(targetYear, targetMonth, anchorDay);
        }
        
        const month = instanceDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        
        instances.push({
          index: i + 1,
          totalCount: 18,
          plannedDate: instanceDate,
          quarter,
        });
      }
      break;
    }

    case "WEEKLY": {
      // Generate 30 days worth of weekly tasks (4-5 instances)
      const thirtyDaysOut = addDays(anchorDate, 30);
      let currentDate = new Date(anchorDate);
      let weekIndex = 1;

      while (currentDate <= thirtyDaysOut) {
        const month = currentDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({
          index: weekIndex,
          totalCount: null, // Rolling generation
          plannedDate: new Date(currentDate),
          quarter,
        });
        currentDate = addDays(currentDate, 7);
        weekIndex++;
      }
      break;
    }

    case "DAILY": {
      // Generate 30 days of daily tasks
      for (let day = 0; day < 30; day++) {
        const dueDate = addDays(anchorDate, day);
        const month = dueDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({
          index: day + 1,
          totalCount: null, // Rolling generation
          plannedDate: dueDate,
          quarter,
        });
      }
      break;
    }

    default: {
      // Unknown frequency - treat as ONE_TIME
      instances.push({
        index: 1,
        totalCount: 1,
        plannedDate: anchorDate,
        quarter: null,
      });
      break;
    }
  }

  return instances;
}

// Helper functions for date arithmetic
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  
  // Handle day overflow (e.g., Jan 31 + 1 month = Mar 3)
  // This will be fixed by the calling code that preserves anchor day
  return result;
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Acquire concurrent request slot (task generation can create hundreds of tasks)
    releaseSlot = await acquireConcurrentSlot(session.user.userId, {
      maxConcurrent: 3, // Low limit for task generation (database intensive)
      errorMessage: "Task generation is already in progress. Please wait for the current generation to complete.",
    });
    
    if (!releaseSlot) {
      return createConcurrentLimitResponse(
        "Task generation is already in progress. Please wait for the current generation to complete."
      );
    }

    await requirePermission(session, "SOURCES", "CREATE");

    const sourceId = context.params.id;
    const body = await req.json();
    const validatedData = bulkGenerateTasksSchema.parse({ ...body, sourceId });

    // Verify source exists and user has access
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: { entities: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const sourceEntityIds = source.entities.map((e: { entityId: string }) => e.entityId);
    const hasAccess = sourceEntityIds.some((id: string) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validation: check for blocking issues
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Build set of valid entity IDs for this source
    const sourceEntityIdSet = new Set(source.entities.map((e: { entityId: string }) => e.entityId));

    if (validatedData.items.length === 0) {
      errors.push("No items provided");
    }

    const totalTasks = validatedData.items.reduce((sum, item) => sum + item.tasks.length, 0);
    if (totalTasks === 0) {
      errors.push("No tasks to generate");
    }

    // Check for items with no tasks
    const itemsWithoutTasks = validatedData.items.filter((item) => item.tasks.length === 0);
    if (itemsWithoutTasks.length > 0) {
      warnings.push(`${itemsWithoutTasks.length} items have no tasks`);
    }

    // Check for tasks with no responsible team
    const tasksWithoutResponsibleTeam = validatedData.items.flatMap((item) =>
      item.tasks.filter((task) => !task.responsibleTeamId)
    );
    if (tasksWithoutResponsibleTeam.length > 0) {
      warnings.push(`${tasksWithoutResponsibleTeam.length} tasks have no responsible team`);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors, warnings },
        { status: 400 }
      );
    }

    // Generate items and tasks in a transaction with extended timeout
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      const tasksToCreate = [];
      const tasksWithoutTeamWarnings = new Set<string>();

      for (const itemData of validatedData.items) {
        // Create source item
        const item = await tx.sourceItem.create({
          data: {
            sourceId,
            reference: itemData.item.reference,
            title: itemData.item.title,
            description: itemData.item.description,
            parentId: itemData.item.parentId,
            sortOrder: itemData.item.sortOrder || 0,
          },
        });

        createdItems.push(item);

        // Prepare tasks for batch creation
        for (const taskData of itemData.tasks) {
          // Validate entityId belongs to source entities
          if (!sourceEntityIdSet.has(taskData.entityId)) {
            throw new Error(`Task "${taskData.name}" has entityId ${taskData.entityId} which is not linked to this source`);
          }
          
          const recurrenceGroupId = uuidv4();
          const instances = calculateRecurrenceInstances(
            taskData.frequency,
            taskData.dueDate ? new Date(taskData.dueDate) : null,
            source.effectiveDate // Pass source effective date as lower bound
          );
          
          // For each recurrence instance, prepare task data
          for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            
            // Determine initial status using shared helper
            let shouldActivate = shouldActivateTask(instance.plannedDate);
            
            // SAFETY: Tasks without responsible team MUST NOT become active actionable work
            if (!taskData.responsibleTeamId && shouldActivate) {
              shouldActivate = false; // Force to PLANNED
              tasksWithoutTeamWarnings.add(taskData.name);
            }

            tasksToCreate.push({
              sourceId,
              sourceItemId: item.id,
              name: taskData.name,
              description: taskData.description,
              expectedOutcome: taskData.expectedOutcome,
              entityId: taskData.entityId,
              frequency: taskData.frequency,
              quarter: instance.quarter || taskData.quarter,
              riskRating: taskData.riskRating,
              assigneeId: taskData.assigneeId || null,
              responsibleTeamId: taskData.responsibleTeamId || null,
              picId: taskData.picId || null,
              reviewerId: taskData.reviewerId || null,
              startDate: taskData.startDate ? new Date(taskData.startDate) : null,
              dueDate: instance.plannedDate,
              plannedDate: instance.plannedDate,
              testingPeriodStart: taskData.testingPeriodStart ? new Date(taskData.testingPeriodStart) : null,
              testingPeriodEnd: taskData.testingPeriodEnd ? new Date(taskData.testingPeriodEnd) : null,
              evidenceRequired: taskData.evidenceRequired,
              narrativeRequired: taskData.narrativeRequired,
              reviewRequired: taskData.reviewRequired,
              clickupUrl: taskData.clickupUrl || null,
              gdriveUrl: taskData.gdriveUrl || null,
              recurrenceGroupId: instances.length > 1 ? recurrenceGroupId : null,
              recurrenceIndex: instances.length > 1 ? instance.index : null,
              recurrenceTotalCount: instances.length > 1 ? instance.totalCount : null,
              status: shouldActivate ? "TO_DO" : "PLANNED",
            });
          }
        }
      }

      // Batch create all tasks at once
      const createdTasksResult = await tx.task.createMany({
        data: tasksToCreate as Prisma.TaskCreateManyInput[],
      });

      // Update source status to ACTIVE
      await tx.source.update({
        where: { id: sourceId },
        data: { status: "ACTIVE" },
      });

      return { 
        createdItems, 
        createdTasksCount: createdTasksResult.count,
        tasksWithoutTeamWarnings
      };
    }, {
      timeout: 120000, // 2 minute timeout for large sources
    });

    // Audit log
    await logAuditEvent({
      action: "SOURCE_GENERATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "Source",
      targetId: sourceId,
      details: {
        itemsCount: result.createdItems.length,
        tasksCount: result.createdTasksCount,
      },
    });

    // Add warning for tasks without responsible team that were forced to PLANNED
    if (result.tasksWithoutTeamWarnings.size > 0) {
      const taskNames = Array.from(result.tasksWithoutTeamWarnings).slice(0, 3);
      warnings.push(
        `${result.tasksWithoutTeamWarnings.size} task(s) kept as PLANNED due to missing responsible team: ${taskNames.join(", ")}${result.tasksWithoutTeamWarnings.size > 3 ? "..." : ""}`
      );
    }

    return NextResponse.json({
      success: true,
      itemsCreated: result.createdItems.length,
      tasksCreated: result.createdTasksCount,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Generation validation error:", JSON.stringify(error.issues, null, 2));
      return NextResponse.json({ 
        error: "Validation failed: " + error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", "),
        issues: error.issues 
      }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source generation error:", error);
    return NextResponse.json({ error: "Failed to generate source tasks" }, { status: 500 });
  } finally {
    // CRITICAL: Always release concurrent slot
    releaseSlot?.();
  }
}
