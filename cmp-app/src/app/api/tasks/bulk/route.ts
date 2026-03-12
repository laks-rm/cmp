import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { bulkTaskSchema } from "@/lib/validations/tasks";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "EDIT");

    const body = await req.json();
    const { taskIds, action, assigneeId, responsibleTeamId, status, dueDate } = bulkTaskSchema.parse(body);

    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        entityId: { in: session.user.entityIds },
      },
    });

    if (tasks.length !== taskIds.length) {
      return NextResponse.json({ error: "Some tasks not found or access denied" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        const updates: Record<string, unknown> = {};

        if (action === "assign" && assigneeId) {
          updates.assigneeId = assigneeId;
          await logAuditEvent({
            action: "TASK_ASSIGNED",
            module: "TASKS",
            userId: session.user.userId,
            entityId: task.entityId,
            targetType: "Task",
            targetId: task.id,
            details: {
              oldAssigneeId: task.assigneeId,
              newAssigneeId: assigneeId,
              bulkOperation: true,
            },
          });
        }

        if (action === "setResponsibleTeam" && responsibleTeamId) {
          updates.responsibleTeamId = responsibleTeamId;
          await logAuditEvent({
            action: "TASK_RESPONSIBLE_TEAM_SET",
            module: "TASKS",
            userId: session.user.userId,
            entityId: task.entityId,
            targetType: "Task",
            targetId: task.id,
            details: {
              oldResponsibleTeamId: task.responsibleTeamId,
              newResponsibleTeamId: responsibleTeamId,
              bulkOperation: true,
            },
          });
        }

        if (action === "changeStatus" && status) {
          updates.status = status;
          if (status === "PENDING_REVIEW") {
            updates.submittedAt = new Date();
          }
          if (status === "COMPLETED") {
            updates.completedAt = new Date();
          }
          await logAuditEvent({
            action: "TASK_STATUS_CHANGED",
            module: "TASKS",
            userId: session.user.userId,
            entityId: task.entityId,
            targetType: "Task",
            targetId: task.id,
            details: {
              oldStatus: task.status,
              newStatus: status,
              bulkOperation: true,
            },
          });
        }

        if (action === "setDueDate" && dueDate) {
          updates.dueDate = new Date(dueDate);
          await logAuditEvent({
            action: "TASK_UPDATED",
            module: "TASKS",
            userId: session.user.userId,
            entityId: task.entityId,
            targetType: "Task",
            targetId: task.id,
            details: {
              field: "dueDate",
              newValue: dueDate,
              bulkOperation: true,
            },
          });
        }

        await tx.task.update({
          where: { id: task.id },
          data: updates,
        });
      }
    });

    await logAuditEvent({
      action: "TASK_BULK_UPDATED",
      module: "TASKS",
      userId: session.user.userId,
      details: {
        action,
        taskCount: taskIds.length,
      },
    });

    return NextResponse.json({ success: true, updatedCount: taskIds.length });
  } catch (error) {
    console.error("POST /api/tasks/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
