import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createCommentSchema } from "@/lib/validations/evidence";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

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

    if (!taskId && !findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
    }

    const comments = await prisma.comment.findMany({
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
    });

    return NextResponse.json(comments);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Comments fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const body = await req.json();
    const validatedData = createCommentSchema.parse(body);

    if (!validatedData.taskId && !validatedData.findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
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
        content: validatedData.content,
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Comment creation error:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
