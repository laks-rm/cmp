import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, getEntityFilter } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { taskQuerySchema, createTaskSchema } from "@/lib/validations/tasks";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const params = taskQuerySchema.parse(searchParams);

    const where: Prisma.TaskWhereInput = {
      AND: [getEntityFilter(session)],
    };

    if (params.entityId) {
      where.entityId = params.entityId;
    }

    if (params.teamId && params.teamId !== "ALL") {
      where.source = { teamId: params.teamId };
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.riskRating) {
      where.riskRating = params.riskRating;
    }

    if (params.frequency) {
      where.frequency = params.frequency;
    }

    if (params.quarter) {
      where.quarter = params.quarter;
    }

    if (params.sourceId) {
      where.sourceId = params.sourceId;
    }

    if (params.search) {
      where.OR = [{ name: { contains: params.search, mode: "insensitive" } }, { description: { contains: params.search, mode: "insensitive" } }];
    }

    const orderBy: Prisma.TaskOrderByWithRelationInput = {};
    if (params.sortBy === "name") {
      orderBy.name = params.sortOrder;
    } else if (params.sortBy === "dueDate") {
      orderBy.dueDate = params.sortOrder;
    } else if (params.sortBy === "status") {
      orderBy.status = params.sortOrder;
    } else if (params.sortBy === "riskRating") {
      orderBy.riskRating = params.sortOrder;
    } else {
      orderBy.createdAt = params.sortOrder;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          source: {
            include: {
              team: true,
              items: {
                take: 1,
              },
            },
          },
          sourceItem: true,
          entity: true,
          assignee: {
            select: {
              id: true,
              name: true,
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
              initials: true,
              avatarColor: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              initials: true,
              avatarColor: true,
            },
          },
        },
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      tasks,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "CREATE");

    const body = await req.json();
    const data = createTaskSchema.parse(body);

    if (!session.user.entityIds.includes(data.entityId)) {
      return NextResponse.json({ error: "Access denied to this entity" }, { status: 403 });
    }

    const task = await prisma.task.create({
      data: {
        name: data.name,
        description: data.description,
        expectedOutcome: data.expectedOutcome,
        riskRating: data.riskRating,
        frequency: data.frequency,
        quarter: data.quarter,
        evidenceRequired: data.evidenceRequired,
        narrativeRequired: data.narrativeRequired,
        reviewRequired: data.reviewRequired,
        narrative: data.narrative,
        clickupUrl: data.clickupUrl,
        gdriveUrl: data.gdriveUrl,
        sourceId: data.sourceId,
        sourceItemId: data.sourceItemId || null,
        entityId: data.entityId,
        assigneeId: data.assigneeId || null,
        responsibleTeamId: data.responsibleTeamId || null,
        picId: data.picId || null,
        reviewerId: data.reviewerId || null,
        status: "TO_DO",
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        testingPeriodStart: data.testingPeriodStart ? new Date(data.testingPeriodStart) : null,
        testingPeriodEnd: data.testingPeriodEnd ? new Date(data.testingPeriodEnd) : null,
      },
      include: {
        source: {
          include: {
            team: true,
          },
        },
        entity: true,
      },
    });

    await logAuditEvent({
      action: "TASK_CREATED",
      module: "TASKS",
      userId: session.user.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: task.id,
      details: {
        taskName: task.name,
        sourceId: task.sourceId,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
