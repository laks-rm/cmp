import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { bulkTaskSchema } from "@/lib/validations/tasks";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";
import { acquireConcurrentSlot, createConcurrentLimitResponse } from "@/lib/concurrentLimit";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Acquire concurrent request slot (prevent resource exhaustion)
    releaseSlot = await acquireConcurrentSlot(session.user.userId, {
      maxConcurrent: 5, // Lower limit for bulk operations (more resource intensive)
      errorMessage: "Too many bulk operations running. Please wait for previous operations to complete.",
    });
    
    if (!releaseSlot) {
      return createConcurrentLimitResponse(
        "Too many bulk operations running. Please wait for previous operations to complete."
      );
    }

    await requirePermission(session, "TASKS", "EDIT");

    // Check for idempotency key
    const idempotencyKey = req.headers.get("x-idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency key required for bulk operations" },
        { status: 400 }
      );
    }

    // Check if already processed
    const idempotencyCheck = await checkIdempotency(idempotencyKey, session.user.userId);
    if (idempotencyCheck.exists) {
      return NextResponse.json(idempotencyCheck.response);
    }

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

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const auditLogs: Array<{
        action: string;
        module: string;
        userId: string;
        entityId: string;
        targetType: string;
        targetId: string;
        details: Record<string, unknown>;
      }> = [];

      for (const task of tasks) {
        const updates: Record<string, unknown> = {};

        if (action === "assign" && assigneeId) {
          updates.picId = assigneeId;
          auditLogs.push({
            action: "TASK_PIC_CHANGED",
            module: "TASKS",
            userId: session.user.userId,
            entityId: task.entityId,
            targetType: "Task",
            targetId: task.id,
            details: {
              oldPicId: task.picId,
              newPicId: assigneeId,
              bulkOperation: true,
            },
          });
        }

        if (action === "setResponsibleTeam" && responsibleTeamId) {
          updates.responsibleTeamId = responsibleTeamId;
          auditLogs.push({
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
          // Validate workflow rules to prevent status bypass
          const validationErrors: string[] = [];
          
          // Rule 1: Tasks requiring review cannot skip to COMPLETED
          if (status === "COMPLETED" && task.reviewRequired) {
            if (task.status !== "PENDING_REVIEW" && task.status !== "COMPLETED") {
              validationErrors.push(
                `Task "${task.name}" requires review before completion (current status: ${task.status})`
              );
            }
          }
          
          // Rule 2: Can only submit for review from certain statuses
          if (status === "PENDING_REVIEW") {
            const allowedStatuses = ["TO_DO", "IN_PROGRESS"];
            if (!allowedStatuses.includes(task.status)) {
              validationErrors.push(
                `Task "${task.name}" cannot be submitted for review from ${task.status} status`
              );
            }
          }
          
          // Rule 3: Cannot move back to TO_DO from COMPLETED
          if (status === "TO_DO" && task.status === "COMPLETED") {
            validationErrors.push(
              `Task "${task.name}" cannot be reopened from COMPLETED status via bulk operation`
            );
          }
          
          // If there are validation errors, throw to rollback transaction
          if (validationErrors.length > 0) {
            throw new Error(`Workflow validation failed: ${validationErrors.join("; ")}`);
          }
          
          updates.status = status;
          if (status === "PENDING_REVIEW") {
            updates.submittedAt = new Date();
          }
          if (status === "COMPLETED") {
            updates.completedAt = new Date();
          }
          auditLogs.push({
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
              workflowValidated: true,
            },
          });
        }

        if (action === "setDueDate" && dueDate) {
          updates.dueDate = new Date(dueDate);
          auditLogs.push({
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

      if (auditLogs.length > 0) {
        await tx.auditLog.createMany({
          data: auditLogs.map((log: {
            action: string;
            module: string;
            userId: string;
            entityId: string;
            targetType: string;
            targetId: string;
            details: Record<string, unknown>;
          }) => ({
            action: log.action,
            module: log.module,
            userId: log.userId,
            entityId: log.entityId,
            targetType: log.targetType,
            targetId: log.targetId,
            details: log.details as Prisma.InputJsonValue,
            createdAt: new Date(),
          })),
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

    const response = { success: true, updatedCount: taskIds.length };

    // Store idempotency result
    await storeIdempotency(idempotencyKey, session.user.userId, response);

    return NextResponse.json(response);
  } catch (error) {
    // Check if this is a workflow validation error
    if (error instanceof Error && error.message.includes("Workflow validation failed")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    console.error("POST /api/tasks/bulk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    // CRITICAL: Always release concurrent slot
    releaseSlot?.();
  }
}
