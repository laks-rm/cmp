import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

const createTaskTypeSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskTypes = await prisma.taskType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: {
          select: { tasks: true },
        },
      },
    });

    return NextResponse.json({ taskTypes });
  } catch (error) {
    console.error("GET /api/task-types error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch task types" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreate = await hasPermission(session, "SOURCES", "CREATE");
    if (!canCreate) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const validated = createTaskTypeSchema.parse(body);

    const existing = await prisma.taskType.findUnique({
      where: { name: validated.name },
    });

    if (existing) {
      return NextResponse.json({ error: "A task type with this name already exists" }, { status: 400 });
    }

    const taskType = await prisma.taskType.create({
      data: {
        name: validated.name,
        description: validated.description || null,
      },
    });

    await logAuditEvent({
      action: "TASK_TYPE_CREATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "TaskType",
      targetId: taskType.id,
      details: { name: taskType.name },
    });

    return NextResponse.json({ taskType }, { status: 201 });
  } catch (error) {
    console.error("POST /api/task-types error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create task type" }, { status: 500 });
  }
}
