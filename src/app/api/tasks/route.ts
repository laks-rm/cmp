import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, getEntityFilter } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { taskQuerySchema, createTaskSchema } from "@/lib/validations/tasks";
import { Prisma } from "@prisma/client";
// Import removed: activatePlannedTasks - activation should only happen via scheduled cron jobs
import { toZonedTime } from "date-fns-tz";
import { startOfWeek, endOfWeek } from "date-fns";
import { taskService } from "@/services/TaskService";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    // NOTE: Auto-activation removed - tasks are activated only by scheduled cron job
    // Previously: await activatePlannedTasks(session.user.userId);
    // This prevents unexpected task state changes during normal read operations

    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const params = taskQuerySchema.parse(searchParams);

    const where: Prisma.TaskWhereInput = {
      AND: [getEntityFilter(session)],
      deletedAt: null, // Exclude soft-deleted tasks
    };

    if (params.entityId) {
      where.entityId = params.entityId;
    }

    if (params.teamId && params.teamId !== "ALL") {
      where.source = { teamId: params.teamId };
    }

    if (params.status) {
      where.status = params.status;
    } else {
      // By default, exclude PLANNED tasks from the task tracker
      // Only show active statuses: TO_DO, IN_PROGRESS, PENDING_REVIEW, COMPLETED, DEFERRED, NOT_APPLICABLE
      where.status = {
        not: "PLANNED"
      };
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

    if (params.picId) {
      where.picId = params.picId;
    }

    if (params.assigneeId) {
      where.assigneeId = params.assigneeId;
    }

    if (params.responsibleTeamId) {
      const teamIds = params.responsibleTeamId.split(",");
      where.responsibleTeamId = { in: teamIds };
    }

    if (params.recurrenceGroupId) {
      where.recurrenceGroupId = params.recurrenceGroupId;
    }

    // Overdue filter: due date before start of today (user timezone), exclude completed
    if (params.overdue) {
      const userTimezone = session.user.timezone || "UTC";
      const nowInUserTz = toZonedTime(new Date(), userTimezone);
      nowInUserTz.setHours(0, 0, 0, 0);
      const startOfTodayUTC = new Date(nowInUserTz.toISOString());
      where.dueDate = { lt: startOfTodayUTC };
      where.status = { notIn: ["COMPLETED", "PLANNED"] };
    }

    // Due this week filter - CAREFUL with timezone conversion
    if (params.preset === "due-week") {
      const userTimezone = session.user.timezone || "UTC";
      const nowInUserTz = toZonedTime(new Date(), userTimezone);
      
      // Get start of week (Monday) in user timezone
      const startOfWeekUserTz = startOfWeek(nowInUserTz, { weekStartsOn: 1 });
      startOfWeekUserTz.setHours(0, 0, 0, 0);
      
      // Get end of week (Sunday) in user timezone
      const endOfWeekUserTz = endOfWeek(startOfWeekUserTz, { weekStartsOn: 1 });
      endOfWeekUserTz.setHours(23, 59, 59, 999);
      
      // Convert back to UTC for database query (dueDate is stored as UTC)
      where.dueDate = {
        gte: new Date(startOfWeekUserTz.toISOString()),
        lte: new Date(endOfWeekUserTz.toISOString())
      };
      where.status = { notIn: ["COMPLETED", "PLANNED"] };
    }

    if (params.noPIC === "true") {
      where.picId = null;
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

    const include = {
      source: {
        include: {
          team: true,
          items: { take: 1 },
        },
      },
      sourceItem: true,
      entity: true,
      assignee: { select: { id: true, name: true, initials: true, avatarColor: true } },
      responsibleTeam: { select: { id: true, name: true } },
      pic: { select: { id: true, name: true, initials: true, avatarColor: true } },
      reviewer: { select: { id: true, name: true, initials: true, avatarColor: true } },
      _count: {
        select: {
          evidence: true,
          comments: true,
        },
      },
    };

    // Default Task Tracker view (no sourceId): show actionable queue only — all overdue open,
    // plus earliest upcoming open per recurrence group. Sources -> View Tasks (sourceId set) shows full list.
    const isQueueView = !params.sourceId;
    let tasks: Awaited<ReturnType<typeof prisma.task.findMany>>;
    let total: number;

    if (isQueueView) {
      const all = await prisma.task.findMany({
        where,
        include,
        orderBy: { dueDate: "asc" },
      });
      const userTimezone = session.user.timezone || "UTC";
      const nowInUserTz = toZonedTime(new Date(), userTimezone);
      nowInUserTz.setHours(0, 0, 0, 0);
      const startOfTodayUTC = new Date(nowInUserTz.toISOString());
      const OPEN_STATUSES = new Set(["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "DEFERRED", "NOT_APPLICABLE"]);

      const overdue = all.filter(
        (t) => t.dueDate !== null && t.dueDate < startOfTodayUTC
      );
      const upcoming = all.filter(
        (t) => t.dueDate === null || t.dueDate >= startOfTodayUTC
      );
      const isOpen = (t: (typeof all)[0]) => OPEN_STATUSES.has(t.status);

      // Upcoming open: keep only earliest per recurrence group (by dueDate). Non-recurring (recurrenceGroupId null) stay all.
      const upcomingOpen = upcoming.filter(isOpen);
      const byGroup = new Map<string | null, typeof upcomingOpen>();
      for (const t of upcomingOpen) {
        const key = t.recurrenceGroupId ?? `single:${t.id}`;
        if (!byGroup.has(key)) byGroup.set(key, []);
        byGroup.get(key)!.push(t);
      }
      const earliestPerGroup: typeof all = [];
      for (const group of Array.from(byGroup.values())) {
        const sorted = [...group].sort((a, b) => {
          if (a.dueDate === null && b.dueDate === null) return 0;
          if (a.dueDate === null) return 1;
          if (b.dueDate === null) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
        });
        earliestPerGroup.push(sorted[0]);
      }
      const upcomingCompleted = upcoming.filter((t) => !isOpen(t));
      const queueIds = new Set([
        ...overdue.map((t) => t.id),
        ...earliestPerGroup.map((t) => t.id),
        ...upcomingCompleted.map((t) => t.id),
      ]);
      const filtered = all.filter((t) => queueIds.has(t.id));

      const sortOrder = params.sortOrder === "desc" ? -1 : 1;
      const sortKey = params.sortBy;
      filtered.sort((a, b) => {
        let av: string | number | Date | null = (a as Record<string, unknown>)[sortKey] as string | number | Date | null;
        let bv: string | number | Date | null = (b as Record<string, unknown>)[sortKey] as string | number | Date | null;
        if (av instanceof Date) av = av.getTime();
        if (bv instanceof Date) bv = bv === null ? 0 : bv.getTime();
        if (av == null) av = sortOrder === 1 ? Infinity : -Infinity;
        if (bv == null) bv = sortOrder === 1 ? Infinity : -Infinity;
        if (typeof av === "string" && typeof bv === "string") return sortOrder * av.localeCompare(bv);
        return sortOrder * ((av as number) - (bv as number));
      });

      total = filtered.length;
      tasks = filtered.slice((params.page - 1) * params.limit, params.page * params.limit);
    } else {
      const [taskList, count] = await Promise.all([
        prisma.task.findMany({
          where,
          include,
          orderBy,
          skip: (params.page - 1) * params.limit,
          take: params.limit,
        }),
        prisma.task.count({ where }),
      ]);
      tasks = taskList;
      total = count;
    }

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

    // Validate PIC is in responsible team if provided
    if (data.picId && data.responsibleTeamId) {
      const picInTeam = await taskService.validatePICInTeam(data.picId, data.responsibleTeamId);
      if (!picInTeam) {
        return NextResponse.json(
          { error: "PIC must be a member of the responsible team" },
          { status: 400 }
        );
      }
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
