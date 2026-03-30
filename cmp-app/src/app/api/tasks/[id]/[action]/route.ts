import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { notifyTaskSubmitted, notifyTaskApproved, notifyTaskRejected } from "@/lib/notifications";
import { Prisma, Task } from "@prisma/client";

/**
 * Updates a task with optimistic locking to prevent race conditions.
 * Uses version field to ensure the task hasn't been modified by another user.
 * 
 * @param taskId - The task ID to update
 * @param currentVersion - The version number at the time of read
 * @param updateData - The data to update
 * @returns Updated task or null if version mismatch
 */
async function updateTaskWithOptimisticLock(
  taskId: string,
  currentVersion: number,
  updateData: Prisma.TaskUpdateInput
): Promise<Task | null> {
  // Use updateMany to check version atomically
  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      version: currentVersion,
    },
    data: {
      ...updateData,
      version: { increment: 1 },
    },
  });

  // If count is 0, version mismatch occurred (concurrent modification)
  if (result.count === 0) {
    return null;
  }

  // Fetch and return the updated task
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

  return updatedTask;
}

export async function POST(req: NextRequest, context: { params: { id: string; action: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskId = context.params.id;
    const action = context.params.action;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        source: { include: { team: true } },
        assignee: true,
        reviewer: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!session.user.entityIds.includes(task.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    switch (action) {
      case "recall": {
        // Only PIC can recall from PENDING_REVIEW
        if (task.picId !== session.user.userId) {
          return NextResponse.json({ error: "Only the person in charge (PIC) can recall this task" }, { status: 403 });
        }
        if (task.status !== "PENDING_REVIEW") {
          return NextResponse.json({ error: "Task must be in PENDING_REVIEW status" }, { status: 400 });
        }

        await requirePermission(session, "TASK_EXECUTION", "EDIT");

        const updatedTask = await updateTaskWithOptimisticLock(taskId, task.version, {
          status: "IN_PROGRESS",
          submittedAt: null,
        });

        if (!updatedTask) {
          return NextResponse.json(
            { error: "Task was modified by another user. Please refresh and try again." },
            { status: 409 }
          );
        }

        await logAuditEvent({
          action: "TASK_RECALLED",
          module: "TASKS",
          userId: session.user.userId,
          entityId: task.entityId,
          targetType: "Task",
          targetId: taskId,
        });

        return NextResponse.json(updatedTask);
      }

      case "approve": {
        // Only reviewer can approve
        if (task.reviewerId !== session.user.userId) {
          return NextResponse.json({ error: "Only the assigned reviewer can approve this task" }, { status: 403 });
        }
        if (task.status !== "PENDING_REVIEW") {
          return NextResponse.json({ error: "Task must be in PENDING_REVIEW status" }, { status: 400 });
        }

        await requirePermission(session, "REVIEW_QUEUE", "APPROVE");

        const updatedTask = await updateTaskWithOptimisticLock(taskId, task.version, {
          status: "COMPLETED",
          reviewedAt: new Date(),
          completedAt: new Date(),
        });

        if (!updatedTask) {
          return NextResponse.json(
            { error: "Task was modified by another user. Please refresh and try again." },
            { status: 409 }
          );
        }

        // Notify PIC
        if (task.picId) {
          await notifyTaskApproved(taskId, task.name, task.picId, session.user.name || "Reviewer");
        }

        await logAuditEvent({
          action: "TASK_APPROVED",
          module: "TASKS",
          userId: session.user.userId,
          entityId: task.entityId,
          targetType: "Task",
          targetId: taskId,
        });

        return NextResponse.json(updatedTask);
      }

      case "request-changes": {
        // Only reviewer can request changes
        if (task.reviewerId !== session.user.userId) {
          return NextResponse.json({ error: "Only the assigned reviewer can request changes" }, { status: 403 });
        }
        if (task.status !== "PENDING_REVIEW") {
          return NextResponse.json({ error: "Task must be in PENDING_REVIEW status" }, { status: 400 });
        }

        await requirePermission(session, "REVIEW_QUEUE", "APPROVE");

        let comment = "";
        
        // Check if this is a FormData request (with files) or JSON request
        const contentType = req.headers.get("content-type") || "";
        
        if (contentType.includes("multipart/form-data")) {
          // Handle FormData with files
          const formData = await req.formData();
          comment = (formData.get("comment") as string) || "";
          
          // Handle file uploads if any
          const files = formData.getAll("files");
          if (files.length > 0) {
            // Store files as evidence attached to the task
            for (const file of files) {
              if (file instanceof File) {
                // You can upload these files to your evidence storage here
                // For now, we'll just log that files were received
                console.log(`Received file for return: ${file.name}`);
              }
            }
          }
        } else {
          // Handle JSON request (backward compatibility)
          const body = await req.json();
          comment = body.comment || "";
        }

        const updatedTask = await updateTaskWithOptimisticLock(taskId, task.version, {
          status: "IN_PROGRESS",
          submittedAt: null,
        });

        if (!updatedTask) {
          return NextResponse.json(
            { error: "Task was modified by another user. Please refresh and try again." },
            { status: 409 }
          );
        }

        // Add comment if provided
        if (comment) {
          await prisma.comment.create({
            data: {
              content: `Changes requested: ${comment}`,
              taskId,
              authorId: session.user.userId,
            },
          });
        }

        // Notify PIC
        if (task.picId) {
          await notifyTaskRejected(taskId, task.name, task.picId, session.user.name || "Reviewer", comment);
        }

        await logAuditEvent({
          action: "TASK_REJECTED",
          module: "TASKS",
          userId: session.user.userId,
          entityId: task.entityId,
          targetType: "Task",
          targetId: taskId,
          details: { comment },
        });

        return NextResponse.json(updatedTask);
      }

      case "mark-complete": {
        // For tasks without approval requirement (CompOps)
        if (task.picId !== session.user.userId) {
          return NextResponse.json({ error: "Only the person in charge (PIC) can mark task complete" }, { status: 403 });
        }
        if (task.reviewRequired) {
          return NextResponse.json({ error: "This task requires approval workflow" }, { status: 400 });
        }

        await requirePermission(session, "TASK_EXECUTION", "EDIT");

        const updatedTask = await updateTaskWithOptimisticLock(taskId, task.version, {
          status: "COMPLETED",
          completedAt: new Date(),
        });

        if (!updatedTask) {
          return NextResponse.json(
            { error: "Task was modified by another user. Please refresh and try again." },
            { status: 409 }
          );
        }

        await logAuditEvent({
          action: "TASK_COMPLETED",
          module: "TASKS",
          userId: session.user.userId,
          entityId: task.entityId,
          targetType: "Task",
          targetId: taskId,
        });

        return NextResponse.json(updatedTask);
      }

      case "submit-review": {
        // Only PIC can submit for review
        if (task.picId !== session.user.userId) {
          return NextResponse.json({ error: "Only the person in charge (PIC) can submit this task for review" }, { status: 403 });
        }
        if (task.status !== "IN_PROGRESS") {
          return NextResponse.json({ error: "Task must be IN_PROGRESS" }, { status: 400 });
        }
        if (!task.reviewRequired) {
          return NextResponse.json({ error: "This task does not require approval" }, { status: 400 });
        }

        await requirePermission(session, "TASK_EXECUTION", "EDIT");

        const updatedTask = await updateTaskWithOptimisticLock(taskId, task.version, {
          status: "PENDING_REVIEW",
          submittedAt: new Date(),
        });

        if (!updatedTask) {
          return NextResponse.json(
            { error: "Task was modified by another user. Please refresh and try again." },
            { status: 409 }
          );
        }

        // Notify reviewer
        if (task.reviewerId) {
          await notifyTaskSubmitted(taskId, task.name, task.reviewerId, session.user.name || "User");
        }

        await logAuditEvent({
          action: "TASK_SUBMITTED_FOR_REVIEW",
          module: "TASKS",
          userId: session.user.userId,
          entityId: task.entityId,
          targetType: "Task",
          targetId: taskId,
        });

        return NextResponse.json(updatedTask);
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error(`POST /api/tasks/[id]/[action] error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
