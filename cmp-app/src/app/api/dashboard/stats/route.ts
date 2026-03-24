import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission, getEntityFilter } from "@/lib/permissions";
import { toZonedTime } from "date-fns-tz";
import { 
  startOfWeek, 
  endOfWeek, 
  startOfQuarter, 
  endOfQuarter, 
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  format
} from "date-fns";

export async function GET(req: NextRequest) {
  console.time("dashboard-stats");
  
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const searchParams = req.nextUrl.searchParams;
    const entityIdParam = searchParams.get("entityId");
    
    // Build base entity filter - all entities user has access to
    const baseEntityFilter = getEntityFilter(session);
    
    // If a specific entity is selected (not GROUP), additionally filter to that entity
    const entityFilter = 
      entityIdParam && entityIdParam !== "GROUP" 
        ? { entityId: entityIdParam } 
        : baseEntityFilter;
    
    const isGroupView = !entityIdParam || entityIdParam === "GROUP";

    // Get user timezone for date calculations
    const userTimezone = session.user.timezone || "UTC";
    const nowInUserTz = toZonedTime(new Date(), userTimezone);
    
    // Calculate date boundaries
    const startOfTodayUserTz = new Date(nowInUserTz);
    startOfTodayUserTz.setHours(0, 0, 0, 0);
    const startOfTodayUTC = new Date(startOfTodayUserTz.toISOString());
    
    const startOfWeekUserTz = startOfWeek(nowInUserTz, { weekStartsOn: 1 });
    startOfWeekUserTz.setHours(0, 0, 0, 0);
    const endOfWeekUserTz = endOfWeek(startOfWeekUserTz, { weekStartsOn: 1 });
    endOfWeekUserTz.setHours(23, 59, 59, 999);
    
    const startOfQuarterDate = startOfQuarter(nowInUserTz);
    const endOfQuarterDate = endOfQuarter(nowInUserTz);
    
    const oneWeekAgo = subDays(nowInUserTz, 7);
    const startOfQuarterOneWeekAgo = startOfQuarter(oneWeekAgo);
    const endOfQuarterOneWeekAgo = endOfQuarter(oneWeekAgo);

    // Base task filter - exclude soft-deleted and PLANNED tasks for most queries
    const baseTaskFilter = {
      ...entityFilter,
      deletedAt: null,
    };

    // Run all queries in parallel
    const [
      dueThisWeek,
      overdue,
      pendingReview,
      oldestPendingReview,
      unassigned,
      quarterTotal,
      quarterCompleted,
      quarterTotalLastWeek,
      quarterCompletedLastWeek,
      actionItems,
      entityComparison,
      teamWorkload,
      sourcesNeedingAttention,
      statusByRiskRating,
      completionTrendData
    ] = await Promise.all([
      // 1. Due this week
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: { notIn: ["COMPLETED", "PLANNED"] },
          dueDate: {
            gte: new Date(startOfWeekUserTz.toISOString()),
            lte: new Date(endOfWeekUserTz.toISOString())
          }
        }
      }),
      
      // 2. Overdue
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: { notIn: ["COMPLETED", "PLANNED"] },
          dueDate: { lt: startOfTodayUTC }
        }
      }),
      
      // 3. Pending review
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: "PENDING_REVIEW"
        }
      }),
      
      // 4. Oldest pending review task
      prisma.task.findFirst({
        where: {
          ...baseTaskFilter,
          status: "PENDING_REVIEW",
          submittedAt: { not: null }
        },
        orderBy: { submittedAt: "asc" },
        select: { submittedAt: true }
      }),
      
      // 5. Unassigned tasks
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: { notIn: ["COMPLETED", "PLANNED"] },
          picId: null
        }
      }),
      
      // 6. Quarter total (for completion percentage)
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: { not: "PLANNED" },
          dueDate: {
            gte: startOfQuarterDate,
            lte: endOfQuarterDate
          }
        }
      }),
      
      // 7. Quarter completed
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: "COMPLETED",
          dueDate: {
            gte: startOfQuarterDate,
            lte: endOfQuarterDate
          }
        }
      }),
      
      // 8. Quarter total (last week) - for trend
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: { not: "PLANNED" },
          dueDate: {
            gte: startOfQuarterOneWeekAgo,
            lte: endOfQuarterOneWeekAgo
          },
          createdAt: { lte: oneWeekAgo }
        }
      }),
      
      // 9. Quarter completed (last week)
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: "COMPLETED",
          dueDate: {
            gte: startOfQuarterOneWeekAgo,
            lte: endOfQuarterOneWeekAgo
          },
          completedAt: { lte: oneWeekAgo }
        }
      }),
      
      // 10. Action items - top 6 urgent tasks
      prisma.task.findMany({
        where: {
          ...baseTaskFilter,
          status: { notIn: ["COMPLETED", "PLANNED", "DEFERRED", "NOT_APPLICABLE"] }
        },
        orderBy: [
          { dueDate: "asc" }
        ],
        take: 6,
        include: {
          entity: { select: { code: true } },
          source: { select: { name: true } }
        }
      }),
      
      // 11. Entity comparison (only if GROUP view)
      isGroupView ? prisma.$queryRaw`
        SELECT 
          e.id as "entityId",
          e.code as "entityCode",
          e.name as "entityName",
          COUNT(CASE WHEN t.status != 'PLANNED' THEN 1 END)::int as total,
          COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed
        FROM "Entity" e
        LEFT JOIN "Task" t ON t."entityId" = e.id 
          AND t."deletedAt" IS NULL
          AND t."dueDate" >= ${startOfQuarterDate}
          AND t."dueDate" <= ${endOfQuarterDate}
        WHERE e.id IN (
          SELECT UNNEST(${session.user.entityIds || []}::text[])
        )
        GROUP BY e.id, e.code, e.name
        ORDER BY e.code
      ` as Promise<Array<{
        entityId: string;
        entityCode: string;
        entityName: string;
        total: number;
        completed: number;
      }>> : Promise.resolve([]),
      
      // 12. Team workload (only if specific entity selected)
      !isGroupView ? prisma.$queryRaw`
        SELECT 
          t.id as "teamId",
          t.name as "teamName",
          COUNT(CASE WHEN task.status = 'COMPLETED' THEN 1 END)::int as completed,
          COUNT(CASE WHEN task.status IN ('TO_DO', 'IN_PROGRESS', 'PENDING_REVIEW') THEN 1 END)::int as active,
          COUNT(CASE WHEN task.status NOT IN ('COMPLETED', 'PLANNED') AND task."dueDate" < ${startOfTodayUTC} THEN 1 END)::int as overdue
        FROM "Team" t
        LEFT JOIN "Task" task ON task."responsibleTeamId" = t.id 
          AND task."deletedAt" IS NULL
          AND task."entityId" = ${entityIdParam}
        WHERE t."isActive" = true
        GROUP BY t.id, t.name
        HAVING COUNT(task.id) > 0
        ORDER BY overdue DESC, active DESC
      ` as Promise<Array<{
        teamId: string;
        teamName: string;
        completed: number;
        active: number;
        overdue: number;
      }>> : Promise.resolve([]),
      
      // 13. Sources needing attention - top 5 with most overdue tasks
      prisma.$queryRaw`
        SELECT 
          s.id as "sourceId",
          s.name as "sourceName",
          t."entityId",
          e.code as "entityCode",
          COUNT(*)::int as total,
          COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int as completed,
          COUNT(CASE WHEN t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE') 
                AND t."dueDate" < ${startOfTodayUTC} THEN 1 END)::int as overdue
        FROM "Source" s
        INNER JOIN "Task" t ON t."sourceId" = s.id
        INNER JOIN "Entity" e ON t."entityId" = e.id
        WHERE t."deletedAt" IS NULL
          AND t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE')
          AND t."dueDate" < ${startOfTodayUTC}
          ${!isGroupView ? Prisma.raw(`AND t."entityId" = '${entityIdParam}'`) : Prisma.raw('')}
          ${isGroupView ? Prisma.raw(`AND t."entityId" IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
        GROUP BY s.id, s.name, t."entityId", e.code
        HAVING COUNT(CASE WHEN t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE') 
                AND t."dueDate" < ${startOfTodayUTC} THEN 1 END) > 0
        ORDER BY overdue DESC
        LIMIT 5
      ` as Promise<Array<{
        sourceId: string;
        sourceName: string;
        entityId: string;
        entityCode: string;
        total: number;
        completed: number;
        overdue: number;
      }>>,
      
      // 14. Status by risk rating (current quarter)
      prisma.$queryRaw`
        SELECT 
          "riskRating",
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::int as "inProgress",
          COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END)::int as "pendingReview",
          COUNT(CASE WHEN status = 'TO_DO' THEN 1 END)::int as "toDo",
          COUNT(CASE WHEN status NOT IN ('COMPLETED', 'PLANNED') AND "dueDate" < ${startOfTodayUTC} THEN 1 END)::int as overdue
        FROM "Task"
        WHERE "deletedAt" IS NULL
          AND status != 'PLANNED'
          AND "dueDate" >= ${startOfQuarterDate}
          AND "dueDate" <= ${endOfQuarterDate}
          ${!isGroupView ? Prisma.raw(`AND "entityId" = '${entityIdParam}'`) : Prisma.raw('')}
          ${isGroupView ? Prisma.raw(`AND "entityId" IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
        GROUP BY "riskRating"
        ORDER BY "riskRating" DESC
      ` as Promise<Array<{
        riskRating: string;
        completed: number;
        inProgress: number;
        pendingReview: number;
        toDo: number;
        overdue: number;
      }>>,
      
      // 15. Completion trend - last 6 months
      (async () => {
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = subMonths(nowInUserTz, i);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          
          months.push({
            month: format(monthDate, 'MMM'),
            start: monthStart,
            end: monthEnd
          });
        }
        
        const results = await Promise.all(months.map(async ({ month, start, end }) => {
          const [completed, active, overdue] = await Promise.all([
            // Completed in this month
            prisma.task.count({
              where: {
                ...baseTaskFilter,
                status: "COMPLETED",
                completedAt: {
                  gte: start,
                  lte: end
                }
              }
            }),
            
            // Active during this month (created before end, not completed before start)
            prisma.task.count({
              where: {
                ...baseTaskFilter,
                status: { in: ["TO_DO", "IN_PROGRESS", "PENDING_REVIEW"] },
                createdAt: { lte: end },
                OR: [
                  { completedAt: null },
                  { completedAt: { gt: end } }
                ]
              }
            }),
            
            // Overdue during this month
            prisma.task.count({
              where: {
                ...baseTaskFilter,
                status: { notIn: ["COMPLETED", "PLANNED"] },
                dueDate: { lt: end },
                createdAt: { lte: end }
              }
            })
          ]);
          
          return { month, completed, active, overdue };
        }));
        
        return results;
      })()
    ]);

    // Calculate KPI metrics
    const quarterCompletion = quarterTotal > 0 
      ? Math.round((quarterCompleted / quarterTotal) * 100) 
      : 0;
    
    const quarterCompletionLastWeek = quarterTotalLastWeek > 0 
      ? Math.round((quarterCompletedLastWeek / quarterTotalLastWeek) * 100) 
      : 0;
    
    const pendingReviewOldestDays = oldestPendingReview?.submittedAt
      ? Math.floor((nowInUserTz.getTime() - new Date(oldestPendingReview.submittedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Format action items
    const formattedActionItems = actionItems.map(task => ({
      id: task.id,
      name: task.name,
      entityCode: task.entity.code,
      status: task.status,
      dueDate: task.dueDate,
      sourceName: task.source?.name || "Unknown Source",
      isOverdue: task.dueDate ? task.dueDate < startOfTodayUTC : false
    }));

    // Format entity comparison with completion percentage
    const formattedEntityComparison = entityComparison.map(entity => ({
      entityId: entity.entityId,
      entityCode: entity.entityCode,
      entityName: entity.entityName,
      total: entity.total,
      completed: entity.completed,
      completionPct: entity.total > 0 ? Math.round((entity.completed / entity.total) * 100) : 0
    }));

    console.timeEnd("dashboard-stats");

    return NextResponse.json({
      kpis: {
        dueThisWeek,
        overdue,
        pendingReview,
        pendingReviewOldestDays,
        unassigned,
        quarterCompletion,
        quarterCompletionPrevWeek: quarterCompletionLastWeek
      },
      actionItems: formattedActionItems,
      completionTrend: completionTrendData,
      entityComparison: isGroupView ? formattedEntityComparison : null,
      teamWorkload: !isGroupView ? teamWorkload : null,
      sourcesNeedingAttention,
      statusByRiskRating
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    console.timeEnd("dashboard-stats");
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
