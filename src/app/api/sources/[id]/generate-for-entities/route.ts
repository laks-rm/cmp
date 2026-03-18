import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { calculateRecurrenceInstances } from "@/lib/utils";
import { shouldActivateTask } from "@/lib/taskActivation";

const generateForEntitiesSchema = z.object({
  entityIds: z.array(z.string().uuid()).min(1),
});

/**
 * POST /api/sources/[id]/generate-for-entities
 * 
 * Generate tasks for specific entities only, without touching existing entities.
 * 
 * Use case: User adds a new entity to an existing source and wants to generate
 * tasks for that entity without disturbing historical tasks for other entities.
 * 
 * Behavior:
 * - Reads existing source items and their task definitions
 * - Generates tasks ONLY for specified entity IDs
 * - Does NOT regenerate tasks for entities that already have them
 * - Does NOT backfill historical tasks (starts from current/future dates)
 * - Preserves all existing task history
 */
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "CREATE");

    const sourceId = context.params.id;
    const body = await req.json();
    const { entityIds } = generateForEntitiesSchema.parse(body);

    // Verify source exists and user has access
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        entities: {
          include: {
            entity: true,
          },
        },
        items: {
          include: {
            tasks: {
              where: { deletedAt: null },
              take: 1, // Just need to know if tasks exist
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Verify requested entities are linked to this source
    const sourceEntityIds = source.entities.map((e) => e.entityId);
    const invalidEntityIds = entityIds.filter((id) => !sourceEntityIds.includes(id));
    if (invalidEntityIds.length > 0) {
      return NextResponse.json(
        {
          error: `Entity IDs ${invalidEntityIds.join(", ")} are not linked to this source`,
        },
        { status: 400 }
      );
    }

    // Check user has access to all requested entities
    const hasAccess = entityIds.every((id) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to one or more requested entities" },
        { status: 403 }
      );
    }

    // Check if tasks already exist for these entities
    const existingTasksCount = await prisma.task.count({
      where: {
        sourceId,
        entityId: { in: entityIds },
        deletedAt: null,
      },
    });

    if (existingTasksCount > 0) {
      return NextResponse.json(
        {
          error: `Tasks already exist for one or more requested entities (${existingTasksCount} tasks found). Will not regenerate existing tasks.`,
          existingTasksCount,
        },
        { status: 409 }
      );
    }

    // Infer task definitions from existing items and tasks
    // We'll look at tasks for other entities to understand the task template structure
    const taskTemplates = new Map<string, any>();

    // Build task templates from existing tasks (from other entities)
    for (const item of source.items) {
      const existingTasks = await prisma.task.findMany({
        where: {
          sourceItemId: item.id,
          deletedAt: null,
          // Get tasks from other entities as templates
          entityId: { notIn: entityIds },
        },
        distinct: ["recurrenceGroupId", "name"], // Get unique task definitions
        take: 50, // Reasonable limit
      });

      // Group by recurrence group or unique task name
      const templates = new Map<string, any>();
      existingTasks.forEach((task) => {
        const key = task.recurrenceGroupId || task.name;
        if (!templates.has(key)) {
          templates.set(key, {
            name: task.name,
            description: task.description,
            expectedOutcome: task.expectedOutcome,
            frequency: task.frequency,
            riskRating: task.riskRating,
            responsibleTeamId: task.responsibleTeamId,
            picId: task.picId,
            reviewerId: task.reviewerId,
            evidenceRequired: task.evidenceRequired,
            narrativeRequired: task.narrativeRequired,
            reviewRequired: task.reviewRequired,
            clickupUrl: task.clickupUrl,
            gdriveUrl: task.gdriveUrl,
            dueDate: task.dueDate,
            startDate: task.startDate,
            recurrenceGroupId: task.recurrenceGroupId,
          });
        }
      });

      if (templates.size > 0) {
        taskTemplates.set(item.id, Array.from(templates.values()));
      }
    }

    if (taskTemplates.size === 0) {
      return NextResponse.json(
        {
          error: "No task templates found. This source may not have any tasks generated yet. Please generate tasks using the source wizard first.",
        },
        { status: 400 }
      );
    }

    // Generate tasks for the new entities
    const tasksToCreate: Prisma.TaskCreateManyInput[] = [];
    const tasksWithoutTeamWarnings = new Set<string>();

    for (const entityId of entityIds) {
      for (const [itemId, templates] of taskTemplates.entries()) {
        for (const template of templates) {
          // Calculate recurrence instances
          const isRecurring = template.frequency !== 'ADHOC';
          const recurrenceGroupId = isRecurring ? uuidv4() : null;
          
          const instances = calculateRecurrenceInstances(
            template.frequency,
            template.dueDate,
            source.effectiveDate
          );

          // Create task instances
          for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];

            // Determine initial status
            let shouldActivate = shouldActivateTask(instance.plannedDate);

            // SAFETY: Tasks without responsible team MUST NOT become active
            if (!template.responsibleTeamId && shouldActivate) {
              shouldActivate = false;
              tasksWithoutTeamWarnings.add(template.name);
            }

            tasksToCreate.push({
              sourceId,
              sourceItemId: itemId,
              name: template.name,
              description: template.description,
              expectedOutcome: template.expectedOutcome,
              entityId,
              frequency: template.frequency,
              quarter: instance.quarter,
              riskRating: template.riskRating,
              responsibleTeamId: template.responsibleTeamId,
              picId: template.picId,
              reviewerId: template.reviewerId,
              startDate: template.startDate,
              dueDate: instance.plannedDate,
              plannedDate: instance.plannedDate,
              evidenceRequired: template.evidenceRequired,
              narrativeRequired: template.narrativeRequired,
              reviewRequired: template.reviewRequired,
              clickupUrl: template.clickupUrl,
              gdriveUrl: template.gdriveUrl,
              recurrenceGroupId,
              recurrenceIndex: isRecurring ? instance.index : null,
              recurrenceTotalCount: isRecurring ? instance.totalCount : null,
              status: shouldActivate ? "TO_DO" : "PLANNED",
            });
          }
        }
      }
    }

    if (tasksToCreate.length === 0) {
      return NextResponse.json(
        {
          error: "No tasks to generate. Task templates may be empty.",
        },
        { status: 400 }
      );
    }

    // Create tasks in batch
    const result = await prisma.task.createMany({
      data: tasksToCreate,
    });

    // Audit log
    await logAuditEvent({
      action: "TASKS_GENERATED_FOR_ENTITIES",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "Source",
      targetId: sourceId,
      details: {
        entityIds,
        tasksCreated: result.count,
        sourceItemsProcessed: taskTemplates.size,
      },
    });

    const warnings: string[] = [];
    if (tasksWithoutTeamWarnings.size > 0) {
      const taskNames = Array.from(tasksWithoutTeamWarnings).slice(0, 3);
      warnings.push(
        `${tasksWithoutTeamWarnings.size} task(s) kept as PLANNED due to missing responsible team: ${taskNames.join(", ")}${tasksWithoutTeamWarnings.size > 3 ? "..." : ""}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${result.count} task(s) for ${entityIds.length} entity/entities`,
      tasksCreated: result.count,
      entityIds,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Entity-specific task generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate tasks for entities" },
      { status: 500 }
    );
  }
}
