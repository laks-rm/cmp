import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

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

    // Reject any attempts to change frequency or firstDueDate
    // These fields define the recurrence pattern and cannot be edited
    if (updates.frequency || updates.firstDueDate) {
      return NextResponse.json(
        { 
          error: "Cannot modify frequency or due date",
          message: "Frequency and first due date are read-only fields that define the recurrence pattern. To change these, you must create a new source with the desired schedule."
        },
        { status: 400 }
      );
    }

    console.log('[RECURRENCE GROUP UPDATE] Updating metadata for all instances');

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
