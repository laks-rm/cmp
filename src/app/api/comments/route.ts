import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createCommentSchema } from "@/lib/validations/evidence";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { hitApiRateLimit } from "@/lib/rate-limit";
import { acquireConcurrentSlot, createConcurrentLimitResponse } from "@/lib/concurrentLimit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const findingId = searchParams.get("findingId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const skip = (page - 1) * limit;

    if (!taskId && !findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
    }

    // CRITICAL: Verify entity access before fetching comments
    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { 
          id: taskId,
          deletedAt: null, // Don't allow comments on soft-deleted tasks
        },
        select: { entityId: true },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      if (!session.user.entityIds.includes(task.entityId)) {
        await logAuditEvent({
          action: "UNAUTHORIZED_ACCESS_ATTEMPT",
          module: "TASKS",
          userId: session.user.userId,
          targetType: "Task",
          targetId: taskId,
          details: {
            reason: "User attempted to access comments for task outside their entity scope",
            taskEntityId: task.entityId,
            userEntityIds: session.user.entityIds,
          },
        });
        return NextResponse.json({ error: "Access denied to this task" }, { status: 403 });
      }
    }

    if (findingId) {
      const finding = await prisma.finding.findUnique({
        where: { 
          id: findingId,
          deletedAt: null, // Don't allow comments on soft-deleted findings
        },
        select: { entityId: true },
      });

      if (!finding) {
        return NextResponse.json({ error: "Finding not found" }, { status: 404 });
      }

      if (!session.user.entityIds.includes(finding.entityId)) {
        await logAuditEvent({
          action: "UNAUTHORIZED_ACCESS_ATTEMPT",
          module: "TASKS",
          userId: session.user.userId,
          targetType: "Finding",
          targetId: findingId,
          details: {
            reason: "User attempted to access comments for finding outside their entity scope",
            findingEntityId: finding.entityId,
            userEntityIds: session.user.entityIds,
          },
        });
        return NextResponse.json({ error: "Access denied to this finding" }, { status: 403 });
      }
    }

    // Now safe to fetch comments with pagination
    const [comments, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where: {
          ...(taskId && { taskId }),
          ...(findingId && { findingId }),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              initials: true,
              avatarColor: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({
        where: {
          ...(taskId && { taskId }),
          ...(findingId && { findingId }),
        },
      }),
    ]);

    return NextResponse.json({
      comments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + comments.length < totalCount,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Comments fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting to prevent comment spam
    if (await hitApiRateLimit(session.user.userId)) {
      await logAuditEvent({
        action: "RATE_LIMIT_HIT",
        module: "TASKS",
        userId: session.user.userId,
        details: {
          endpoint: "/api/comments",
          method: "POST",
        },
      });
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.", 
          code: "RATE_LIMIT_EXCEEDED" 
        },
        { status: 429 }
      );
    }

    // Concurrent request limit to prevent abuse
    releaseSlot = await acquireConcurrentSlot(session.user.userId, {
      maxConcurrent: 10,
      errorMessage: "Too many concurrent comment operations. Please wait.",
    });

    if (!releaseSlot) {
      return createConcurrentLimitResponse(
        "Too many concurrent comment operations. Please wait."
      );
    }

    await requirePermission(session, "TASKS", "VIEW");

    const body = await req.json();
    const validatedData = createCommentSchema.parse(body);

    if (!validatedData.taskId && !validatedData.findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
    }

    // Verify entity access for task
    if (validatedData.taskId) {
      const task = await prisma.task.findUnique({
        where: { 
          id: validatedData.taskId,
          deletedAt: null, // Don't allow comments on soft-deleted tasks
        },
        select: { entityId: true },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      if (!session.user.entityIds.includes(task.entityId)) {
        return NextResponse.json({ error: "Access denied to this task" }, { status: 403 });
      }
    }

    // Verify entity access for finding
    if (validatedData.findingId) {
      const finding = await prisma.finding.findUnique({
        where: { 
          id: validatedData.findingId,
          deletedAt: null, // Don't allow comments on soft-deleted findings
        },
        select: { entityId: true },
      });

      if (!finding) {
        return NextResponse.json({ error: "Finding not found" }, { status: 404 });
      }

      if (!session.user.entityIds.includes(finding.entityId)) {
        return NextResponse.json({ error: "Access denied to this finding" }, { status: 403 });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: validatedData.content,
        taskId: validatedData.taskId,
        findingId: validatedData.findingId,
        authorId: session.user.userId,
      },
      include: {
        author: {
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

    // Audit log
    await logAuditEvent({
      action: "COMMENT_ADDED",
      module: "TASKS",
      userId: session.user.userId,
      targetType: validatedData.taskId ? "Task" : "Finding",
      targetId: validatedData.taskId || validatedData.findingId || undefined,
      details: {
        commentId: comment.id,
        contentLength: validatedData.content.length,
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Comment creation error:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  } finally {
    if (releaseSlot) releaseSlot();
  }
}

export async function DELETE(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    if (await hitApiRateLimit(session.user.userId)) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.", 
          code: "RATE_LIMIT_EXCEEDED" 
        },
        { status: 429 }
      );
    }

    // Concurrent request limit
    releaseSlot = await acquireConcurrentSlot(session.user.userId);
    if (!releaseSlot) {
      return createConcurrentLimitResponse();
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    }

    // Fetch comment with entity access check
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: { 
          select: { 
            entityId: true,
            deletedAt: true, 
          } 
        },
        finding: { 
          select: { 
            entityId: true,
            deletedAt: true,
          } 
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify user can delete (must be author OR have delete permission)
    const isAuthor = comment.authorId === session.user.userId;
    
    // Check if user has delete permission for the module
    try {
      await requirePermission(session, "TASKS", "DELETE");
      // Has admin delete permission
    } catch (permError) {
      // No admin permission, must be the author
      if (!isAuthor) {
        return NextResponse.json(
          { error: "You can only delete your own comments" },
          { status: 403 }
        );
      }
    }

    // Verify entity access
    const entityId = comment.task?.entityId || comment.finding?.entityId;
    if (entityId && !session.user.entityIds.includes(entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Don't allow deleting comments on soft-deleted tasks/findings
    const isParentDeleted = comment.task?.deletedAt || comment.finding?.deletedAt;
    if (isParentDeleted) {
      return NextResponse.json(
        { error: "Cannot delete comments on deleted tasks/findings" },
        { status: 400 }
      );
    }

    // Delete comment
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Audit log
    await logAuditEvent({
      action: "COMMENT_DELETED",
      module: "TASKS",
      userId: session.user.userId,
      targetType: comment.taskId ? "Task" : "Finding",
      targetId: comment.taskId || comment.findingId || undefined,
      details: {
        commentId: comment.id,
        deletedByAuthor: isAuthor,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Comment deletion error:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  } finally {
    if (releaseSlot) releaseSlot();
  }
}

