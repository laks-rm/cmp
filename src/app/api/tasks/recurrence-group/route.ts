import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { calculateRecurrenceInstances } from "@/lib/utils";

const updateRecurrenceGroupSchema = z.object({
  recurrenceGroupId: z.string().uuid(),
  updates: z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    expectedOutcome: z.string().nullable().optional(),
    frequency: z.enum([
      "ADHOC",
      "DAILY",
      "WEEKLY",
      "MONTHLY",
      "QUARTERLY",
      "SEMI_ANNUAL",
      "ANNUAL",
      "BIENNIAL",
      "ONE_TIME",
    ]).optional(),
    riskRating: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    responsibleTeamId: z.string().uuid().nullable().optional(),
    picId: z.string().uuid().nullable().optional(),
    reviewerId: z.string().uuid().nullable().optional(),
    evidenceRequired: z.boolean().optional(),
    reviewRequired: z.boolean().optional(),
    narrativeRequired: z.boolean().optional(),
    firstDueDate: z.string().datetime().optional(), // For recurrence anchor changes
  }),
});

/**
 * PATCH /api/tasks/recurrence-group
 * Update all tasks in a recurrence group at the template level
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "EDIT");

    const body = await req.json();
    const { recurrenceGroupId, updates } = updateRecurrenceGroupSchema.parse(body);

    console.log('[RECURRENCE GROUP UPDATE] Request received:', {
      recurrenceGroupId,
      updateKeys: Object.keys(updates),
    });

    // Fetch existing tasks in the recurrence group
    const existingTasks = await prisma.task.findMany({
      where: {
        recurrenceGroupId,
        deletedAt: null,
      },
      include: {
        source: true,
        entity: true,
      },
      orderBy: {
        recurrenceIndex: "asc",
      },
    });

    console.log('[RECURRENCE GROUP UPDATE] Tasks found:', existingTasks.length);

    if (existingTasks.length === 0) {
      // Check if the recurrence group exists but is deleted
      const deletedTasks = await prisma.task.count({
        where: {
          recurrenceGroupId,
          deletedAt: { not: null },
        },
      });
      
      console.log('[RECURRENCE GROUP UPDATE] Deleted tasks with this ID:', deletedTasks);
      
      return NextResponse.json(
        { 
          error: "Recurrence group not found",
          details: deletedTasks > 0 
            ? "All tasks in this recurrence group have been deleted" 
            : "No tasks found with this recurrence group ID"
        },
        { status: 404 }
      );
    }

    // Check entity access
    const taskEntityIds = existingTasks.map((t) => t.entityId);
    const hasAccess = taskEntityIds.some((id) =>
      session.user.entityIds.includes(id)
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // If frequency or firstDueDate changed, regenerate instances
    const shouldRegenerateInstances =
      updates.frequency || updates.firstDueDate;

    if (shouldRegenerateInstances) {
      // Get the new parameters
      const newFrequency = updates.frequency || existingTasks[0].frequency;
      const newFirstDueDate = updates.firstDueDate
        ? new Date(updates.firstDueDate)
        : existingTasks[0].dueDate;

      if (!newFirstDueDate) {
        return NextResponse.json(
          { error: "Cannot regenerate instances without a due date" },
          { status: 400 }
        );
      }

      // Calculate new instances
      const newInstances = calculateRecurrenceInstances(
        newFrequency,
        newFirstDueDate,
        existingTasks[0].source.effectiveDate
      );

      // Create a new recurrence group ID for the regenerated tasks
      const newRecurrenceGroupId = uuidv4();

      await prisma.$transaction(async (tx) => {
        // Soft delete old tasks (mark as superseded)
        await tx.task.updateMany({
          where: {
            recurrenceGroupId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            deletedBy: session.user.userId,
            deletedReason: "Recurrence pattern updated - instances regenerated",
          },
        });

        // Create new tasks with updated instances
        const tasksToCreate = newInstances.map((instance) => ({
          sourceId: existingTasks[0].sourceId,
          sourceItemId: existingTasks[0].sourceItemId,
          name: updates.name || existingTasks[0].name,
          description: updates.description !== undefined ? updates.description : existingTasks[0].description,
          expectedOutcome: updates.expectedOutcome !== undefined ? updates.expectedOutcome : existingTasks[0].expectedOutcome,
          entityId: existingTasks[0].entityId,
          frequency: newFrequency,
          quarter: instance.quarter,
          riskRating: updates.riskRating || existingTasks[0].riskRating,
          assigneeId: existingTasks[0].assigneeId,
          responsibleTeamId: updates.responsibleTeamId !== undefined ? updates.responsibleTeamId : existingTasks[0].responsibleTeamId,
          picId: updates.picId !== undefined ? updates.picId : existingTasks[0].picId,
          reviewerId: updates.reviewerId !== undefined ? updates.reviewerId : existingTasks[0].reviewerId,
          startDate: existingTasks[0].startDate,
          dueDate: instance.plannedDate,
          plannedDate: instance.plannedDate,
          testingPeriodStart: existingTasks[0].testingPeriodStart,
          testingPeriodEnd: existingTasks[0].testingPeriodEnd,
          evidenceRequired: updates.evidenceRequired !== undefined ? updates.evidenceRequired : existingTasks[0].evidenceRequired,
          narrativeRequired: updates.narrativeRequired !== undefined ? updates.narrativeRequired : existingTasks[0].narrativeRequired,
          reviewRequired: updates.reviewRequired !== undefined ? updates.reviewRequired : existingTasks[0].reviewRequired,
          clickupUrl: existingTasks[0].clickupUrl,
          gdriveUrl: existingTasks[0].gdriveUrl,
          recurrenceGroupId: newRecurrenceGroupId,
          recurrenceIndex: instance.index,
          recurrenceTotalCount: instance.totalCount,
          status: "PLANNED", // All new instances start as PLANNED
        }));

        await tx.task.createMany({
          data: tasksToCreate,
        });
      });

      await logAuditEvent({
        action: "RECURRENCE_GROUP_REGENERATED",
        module: "TASKS",
        userId: session.user.userId,
        targetType: "RecurrenceGroup",
        targetId: recurrenceGroupId,
        details: {
          oldGroupId: recurrenceGroupId,
          newGroupId: newRecurrenceGroupId,
          oldFrequency: existingTasks[0].frequency,
          newFrequency,
          instanceCount: newInstances.length,
          updates,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Recurrence group regenerated successfully",
        newRecurrenceGroupId,
        instanceCount: newInstances.length,
      });
    }

    // Simple metadata update - update all tasks in the group
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.expectedOutcome !== undefined) updateData.expectedOutcome = updates.expectedOutcome;
    if (updates.riskRating !== undefined) updateData.riskRating = updates.riskRating;
    if (updates.responsibleTeamId !== undefined) updateData.responsibleTeamId = updates.responsibleTeamId;
    if (updates.picId !== undefined) updateData.picId = updates.picId;
    if (updates.reviewerId !== undefined) updateData.reviewerId = updates.reviewerId;
    if (updates.evidenceRequired !== undefined) updateData.evidenceRequired = updates.evidenceRequired;
    if (updates.reviewRequired !== undefined) updateData.reviewRequired = updates.reviewRequired;
    if (updates.narrativeRequired !== undefined) updateData.narrativeRequired = updates.narrativeRequired;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const updatedCount = await prisma.task.updateMany({
      where: {
        recurrenceGroupId,
        deletedAt: null,
      },
      data: updateData,
    });

    await logAuditEvent({
      action: "RECURRENCE_GROUP_UPDATED",
      module: "TASKS",
      userId: session.user.userId,
      targetType: "RecurrenceGroup",
      targetId: recurrenceGroupId,
      details: {
        instancesUpdated: updatedCount.count,
        updates,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount.count} task instance(s)`,
      instancesUpdated: updatedCount.count,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating recurrence group:", error);
    return NextResponse.json(
      { error: "Failed to update recurrence group" },
      { status: 500 }
    );
  }
}
