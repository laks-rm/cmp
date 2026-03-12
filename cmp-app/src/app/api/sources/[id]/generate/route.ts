import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { bulkGenerateTasksSchema } from "@/lib/validations/sources";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { addDays, endOfMonth, endOfYear, startOfYear, differenceInDays } from "date-fns";

type RecurrenceInstance = {
  index: number;
  totalCount: number;
  plannedDate: Date;
  quarter: string | null;
};

function calculateRecurrenceInstances(frequency: string, baseDueDate: Date | null): RecurrenceInstance[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const instances: RecurrenceInstance[] = [];

  switch (frequency) {
    case "ANNUAL": {
      const dueDate = baseDueDate || endOfYear(new Date(currentYear, 11, 31));
      instances.push({ index: 1, totalCount: 1, plannedDate: dueDate, quarter: null });
      break;
    }

    case "BIENNIAL": {
      const dueDate = baseDueDate || endOfYear(new Date(currentYear, 11, 31));
      instances.push({ index: 1, totalCount: 1, plannedDate: dueDate, quarter: null });
      break;
    }

    case "SEMI_ANNUAL": {
      const h1Due = new Date(currentYear, 5, 30); // June 30
      const h2Due = new Date(currentYear, 11, 31); // Dec 31
      instances.push(
        { index: 1, totalCount: 2, plannedDate: h1Due, quarter: "H1" },
        { index: 2, totalCount: 2, plannedDate: h2Due, quarter: "H2" }
      );
      break;
    }

    case "QUARTERLY": {
      const q1Due = new Date(currentYear, 2, 31); // Mar 31
      const q2Due = new Date(currentYear, 5, 30); // Jun 30
      const q3Due = new Date(currentYear, 8, 30); // Sep 30
      const q4Due = new Date(currentYear, 11, 31); // Dec 31
      instances.push(
        { index: 1, totalCount: 4, plannedDate: q1Due, quarter: "Q1" },
        { index: 2, totalCount: 4, plannedDate: q2Due, quarter: "Q2" },
        { index: 3, totalCount: 4, plannedDate: q3Due, quarter: "Q3" },
        { index: 4, totalCount: 4, plannedDate: q4Due, quarter: "Q4" }
      );
      break;
    }

    case "MONTHLY": {
      for (let month = 0; month < 12; month++) {
        const dueDate = endOfMonth(new Date(currentYear, month, 1));
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({ index: month + 1, totalCount: 12, plannedDate: dueDate, quarter });
      }
      break;
    }

    case "WEEKLY": {
      const startDate = startOfYear(new Date(currentYear, 0, 1));
      for (let week = 0; week < 52; week++) {
        const dueDate = addDays(startDate, week * 7 + 4); // Friday of each week
        const month = dueDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({ index: week + 1, totalCount: 52, plannedDate: dueDate, quarter });
      }
      break;
    }

    case "DAILY": {
      const startDate = startOfYear(new Date(currentYear, 0, 1));
      for (let day = 0; day < 365; day++) {
        const dueDate = addDays(startDate, day);
        const month = dueDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({ index: day + 1, totalCount: 365, plannedDate: dueDate, quarter });
      }
      break;
    }

    case "ONE_TIME":
    default: {
      const dueDate = baseDueDate || new Date(currentYear, 11, 31);
      instances.push({ index: 1, totalCount: 1, plannedDate: dueDate, quarter: null });
      break;
    }
  }

  return instances;
}

function shouldStartAsActive(plannedDate: Date): boolean {
  const now = new Date();
  const daysUntilPlanned = differenceInDays(plannedDate, now);
  return daysUntilPlanned <= 30;
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const sourceEntityIds = source.entities.map((e) => e.entityId);
    const hasAccess = sourceEntityIds.some((id) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validation: check for blocking issues
    const errors: string[] = [];
    const warnings: string[] = [];

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

    // Generate items and tasks in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      const createdTasks = [];

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

        // Create tasks for this item with recurrence support
        for (const taskData of itemData.tasks) {
          const recurrenceGroupId = uuidv4();
          const instances = calculateRecurrenceInstances(taskData.frequency, taskData.dueDate ? new Date(taskData.dueDate) : null);
          
          // For each recurrence instance, create a task
          for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            const isFirstInstance = i === 0;
            const shouldActivate = isFirstInstance || shouldStartAsActive(instance.plannedDate);

            const task = await tx.task.create({
              data: {
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
              },
            });

            createdTasks.push(task);
          }
        }
      }

      // Update source status to ACTIVE
      await tx.source.update({
        where: { id: sourceId },
        data: { status: "ACTIVE" },
      });

      return { createdItems, createdTasks };
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
        tasksCount: result.createdTasks.length,
      },
    });

    return NextResponse.json({
      success: true,
      itemsCreated: result.createdItems.length,
      tasksCreated: result.createdTasks.length,
      warnings,
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
  }
}
