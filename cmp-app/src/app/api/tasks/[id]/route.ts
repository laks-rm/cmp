import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { updateTaskSchema } from "@/lib/validations/tasks";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const taskId = context.params.id;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        source: {
          include: {
            team: true,
          },
        },
        sourceItem: {
          select: {
            reference: true,
            title: true,
            description: true,
          },
        },
        entity: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
        responsibleTeam: {
          select: {
            id: true,
            name: true,
          },
        },
        pic: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!session.user.entityIds.includes(task.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASK_EXECUTION", "EDIT");

    const taskId = context.params.id;
    const body = await req.json();
    const data = updateTaskSchema.parse(body);

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { source: { include: { team: true } } },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!session.user.entityIds.includes(existingTask.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    
    // Copy all fields from validated data, converting empty strings to null for UUID fields
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.expectedOutcome !== undefined) updates.expectedOutcome = data.expectedOutcome;
    if (data.riskRating !== undefined) updates.riskRating = data.riskRating;
    if (data.frequency !== undefined) updates.frequency = data.frequency;
    if (data.quarter !== undefined) updates.quarter = data.quarter;
    if (data.evidenceRequired !== undefined) updates.evidenceRequired = data.evidenceRequired;
    if (data.narrativeRequired !== undefined) updates.narrativeRequired = data.narrativeRequired;
    if (data.reviewRequired !== undefined) updates.reviewRequired = data.reviewRequired;
    if (data.narrative !== undefined) updates.narrative = data.narrative;
    if (data.clickupUrl !== undefined) updates.clickupUrl = data.clickupUrl;
    if (data.gdriveUrl !== undefined) updates.gdriveUrl = data.gdriveUrl;
    if (data.sourceId !== undefined) updates.sourceId = data.sourceId;
    if (data.sourceItemId !== undefined) updates.sourceItemId = data.sourceItemId || null;
    if (data.entityId !== undefined) updates.entityId = data.entityId;
    if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId || null;
    if (data.responsibleTeamId !== undefined) updates.responsibleTeamId = data.responsibleTeamId || null;
    if (data.picId !== undefined) updates.picId = data.picId || null;
    if (data.reviewerId !== undefined) updates.reviewerId = data.reviewerId || null;

    if (data.status && data.status !== existingTask.status) {
      const allowedStatuses = existingTask.source.team.statusFlow as string[];
      if (!allowedStatuses.includes(data.status)) {
        return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
      }

      updates.status = data.status;

      if (data.status === "PENDING_REVIEW") {
        updates.submittedAt = new Date();
        if (existingTask.reviewerId) {
          await prisma.notification.create({
            data: {
              type: "TASK_SUBMITTED",
              title: "Task Submitted for Review",
              message: `Task "${existingTask.source.name}" has been submitted for your review`,
              userId: existingTask.reviewerId,
              linkUrl: `/tasks/${taskId}`,
            },
          });
        }
      }

      if (data.status === "COMPLETED") {
        updates.completedAt = new Date();
      }

      await logAuditEvent({
        action: "TASK_STATUS_CHANGED",
        module: "TASKS",
        userId: session.user.userId,
        entityId: existingTask.entityId,
        targetType: "Task",
        targetId: taskId,
        details: {
          oldStatus: existingTask.status,
          newStatus: data.status,
        },
      });
    }

    if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
      await logAuditEvent({
        action: "TASK_ASSIGNED",
        module: "TASKS",
        userId: session.user.userId,
        entityId: existingTask.entityId,
        targetType: "Task",
        targetId: taskId,
        details: {
          oldAssigneeId: existingTask.assigneeId,
          newAssigneeId: data.assigneeId,
        },
      });
    }

    if (data.picId && data.picId !== existingTask.picId) {
      await logAuditEvent({
        action: "TASK_PIC_CHANGED",
        module: "TASKS",
        userId: session.user.userId,
        entityId: existingTask.entityId,
        targetType: "Task",
        targetId: taskId,
        details: {
          oldPicId: existingTask.picId,
          newPicId: data.picId,
        },
      });
    }

    if (data.reviewerId !== undefined && data.reviewerId !== existingTask.reviewerId) {
      await logAuditEvent({
        action: "TASK_REVIEWER_CHANGED",
        module: "TASKS",
        userId: session.user.userId,
        entityId: existingTask.entityId,
        targetType: "Task",
        targetId: taskId,
        details: {
          oldReviewerId: existingTask.reviewerId,
          newReviewerId: data.reviewerId,
        },
      });
    }

    if (data.narrative !== undefined && data.narrative !== existingTask.narrative) {
      await logAuditEvent({
        action: "TASK_NARRATIVE_UPDATED",
        module: "TASKS",
        userId: session.user.userId,
        entityId: existingTask.entityId,
        targetType: "Task",
        targetId: taskId,
        details: {
          narrativeLength: data.narrative?.length || 0,
        },
      });
    }

    if (data.dueDate) {
      updates.dueDate = new Date(data.dueDate);
    }
    if (data.startDate) {
      updates.startDate = new Date(data.startDate);
    }
    if (data.testingPeriodStart) {
      updates.testingPeriodStart = new Date(data.testingPeriodStart);
    }
    if (data.testingPeriodEnd) {
      updates.testingPeriodEnd = new Date(data.testingPeriodEnd);
    }

    // Use optimistic locking with version field
    const result = await prisma.task.updateMany({
      where: {
        id: taskId,
        version: existingTask.version,
      },
      data: {
        ...updates,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Task was modified by another user. Please refresh and try again." },
        { status: 409 }
      );
    }

    // Fetch the updated task to return
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        source: {
          include: {
            team: true,
          },
        },
        entity: true,
        assignee: true,
        pic: true,
        reviewer: true,
      },
    });

    await logAuditEvent({
      action: "TASK_UPDATED",
      module: "TASKS",
      userId: session.user.userId,
      entityId: existingTask.entityId,
      targetType: "Task",
      targetId: taskId,
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
