import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { notifyTaskSubmitted, notifyTaskApproved, notifyTaskRejected } from "@/lib/notifications";

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
        // Only assignee can recall from PENDING_REVIEW
        if (task.assigneeId !== session.user.userId) {
          return NextResponse.json({ error: "Only the assignee can recall this task" }, { status: 403 });
        }
        if (task.status !== "PENDING_REVIEW") {
          return NextResponse.json({ error: "Task must be in PENDING_REVIEW status" }, { status: 400 });
        }

        await requirePermission(session, "TASK_EXECUTION", "EDIT");

        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "IN_PROGRESS",
            submittedAt: null,
          },
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

        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "COMPLETED",
            reviewedAt: new Date(),
            completedAt: new Date(),
          },
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

        // Notify assignee
        if (task.assigneeId) {
          await notifyTaskApproved(taskId, task.name, task.assigneeId, session.user.name || "Reviewer");
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

        const body = await req.json();
        const comment = body.comment || "";

        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "IN_PROGRESS",
            submittedAt: null,
          },
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

        // Notify assignee
        if (task.assigneeId) {
          await notifyTaskRejected(taskId, task.name, task.assigneeId, session.user.name || "Reviewer", comment);
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
        if (task.assigneeId !== session.user.userId && task.picId !== session.user.userId) {
          return NextResponse.json({ error: "Only assignee or PIC can mark task complete" }, { status: 403 });
        }
        if (task.source.team.approvalRequired) {
          return NextResponse.json({ error: "This task requires approval workflow" }, { status: 400 });
        }

        await requirePermission(session, "TASK_EXECUTION", "EDIT");

        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
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
        // Only assignee can submit for review
        if (task.assigneeId !== session.user.userId) {
          return NextResponse.json({ error: "Only the assignee can submit this task for review" }, { status: 403 });
        }
        if (task.status !== "IN_PROGRESS") {
          return NextResponse.json({ error: "Task must be IN_PROGRESS" }, { status: 400 });
        }
        if (!task.source.team.approvalRequired) {
          return NextResponse.json({ error: "This task does not require approval" }, { status: 400 });
        }

        await requirePermission(session, "TASK_EXECUTION", "EDIT");

        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "PENDING_REVIEW",
            submittedAt: new Date(),
          },
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
