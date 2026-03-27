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
    
    const oneWeekAgo = subDays(nowInUserTz, 7);
    const startOfQuarterOneWeekAgo = startOfQuarter(oneWeekAgo);
    const endOfQuarterOneWeekAgo = endOfQuarter(oneWeekAgo);

    // Base task filter
    const baseTaskFilter = {
      ...entityFilter,
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
      completionTrendData,
      openFindings,
      openFindingsTopList,
      slaAdherenceData,
      avgCompletionData,
      regulatoryCoverage,
      compliancePosture,
      upcomingDeadlines,
      monitoringAreaPosture
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
      
      // 6. Quarter total (for completion percentage) - only tasks due to date
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: { not: "PLANNED" },
          dueDate: {
            gte: startOfQuarterDate,
            lte: startOfTodayUTC // Only count tasks due up to today
          }
        }
      }),
      
      // 7. Quarter completed - only tasks due to date
      prisma.task.count({
        where: {
          ...baseTaskFilter,
          status: "COMPLETED",
          dueDate: {
            gte: startOfQuarterDate,
            lte: startOfTodayUTC // Only count tasks due up to today
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
      
      // 11. Entity comparison (only if GROUP view) - only count tasks due to date
      isGroupView ? prisma.$queryRaw`
        SELECT 
          e.id as "entityId",
          e.code as "entityCode",
          e.name as "entityName",
          COUNT(CASE WHEN t.status != 'PLANNED' AND t."dueDate" <= ${startOfTodayUTC} THEN 1 END)::int as total,
          COUNT(CASE WHEN t.status = 'COMPLETED' AND t."dueDate" <= ${startOfTodayUTC} THEN 1 END)::int as completed
        FROM "Entity" e
        LEFT JOIN "Task" t ON t."entityId" = e.id 
          AND t."dueDate" >= ${startOfQuarterDate}
          AND t."dueDate" <= ${startOfTodayUTC}
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
      
      // 12. Team workload (only if specific entity selected) - only count tasks due to date
      !isGroupView ? prisma.$queryRaw`
        SELECT 
          t.id as "teamId",
          t.name as "teamName",
          COUNT(CASE WHEN task.status = 'COMPLETED' AND task."dueDate" <= ${startOfTodayUTC} THEN 1 END)::int as completed,
          COUNT(CASE WHEN task.status IN ('TO_DO', 'IN_PROGRESS', 'PENDING_REVIEW') AND task."dueDate" <= ${startOfTodayUTC} THEN 1 END)::int as active,
          COUNT(CASE WHEN task.status NOT IN ('COMPLETED', 'PLANNED') AND task."dueDate" < ${startOfTodayUTC} THEN 1 END)::int as overdue
        FROM "Team" t
        LEFT JOIN "Task" task ON task."responsibleTeamId" = t.id 
          AND task."entityId" = ${entityIdParam}
          AND task."dueDate" <= ${startOfTodayUTC}
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
        WHERE t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE')
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
      
      // 14. Status by risk rating (current quarter) - only count tasks due to date
      prisma.$queryRaw`
        SELECT 
          "riskRating",
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as completed,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::int as "inProgress",
          COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END)::int as "pendingReview",
          COUNT(CASE WHEN status = 'TO_DO' THEN 1 END)::int as "toDo",
          COUNT(CASE WHEN status NOT IN ('COMPLETED', 'PLANNED') AND "dueDate" < ${startOfTodayUTC} THEN 1 END)::int as overdue
        FROM "Task"
        WHERE status != 'PLANNED'
          AND "dueDate" >= ${startOfQuarterDate}
          AND "dueDate" <= ${startOfTodayUTC}
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
      
      // 15. Completion trend - last 6 months (only tasks due in each month)
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
            // Completed tasks with due date in this month
            prisma.task.count({
              where: {
                ...baseTaskFilter,
                status: "COMPLETED",
                dueDate: {
                  gte: start,
                  lte: end
                }
              }
            }),
            
            // Active tasks with due date in this month
            prisma.task.count({
              where: {
                ...baseTaskFilter,
                status: { in: ["TO_DO", "IN_PROGRESS", "PENDING_REVIEW"] },
                dueDate: {
                  gte: start,
                  lte: end
                }
              }
            }),
            
            // Overdue tasks with due date in this month
            prisma.task.count({
              where: {
                ...baseTaskFilter,
                status: { notIn: ["COMPLETED", "PLANNED"] },
                dueDate: {
                  gte: start,
                  lt: start // Overdue means due date < start of month and not completed
                },
                createdAt: { lte: end }
              }
            })
          ]);
          
          return { month, completed, active, overdue };
        }));
        
        return results;
      })(),
      
      // 16. Open findings count by severity
      prisma.$queryRaw`
        SELECT 
          severity,
          COUNT(*)::int as count
        FROM "Finding"
        WHERE status IN ('OPEN', 'IN_PROGRESS')
          ${!isGroupView ? Prisma.raw(`AND "entityId" = '${entityIdParam}'`) : Prisma.raw('')}
          ${isGroupView ? Prisma.raw(`AND "entityId" IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
        GROUP BY severity
        ORDER BY 
          CASE severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
            WHEN 'OBSERVATION' THEN 5
          END
      ` as Promise<Array<{
        severity: string;
        count: number;
      }>>,
      
      // 17. Top 5 open findings for findings overview section
      prisma.finding.findMany({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          ...entityFilter
        },
        orderBy: [
          { 
            severity: "asc" // Will need custom sort: CRITICAL, HIGH, MEDIUM, LOW
          },
          { targetDate: "asc" }
        ],
        take: 5,
        include: {
          entity: { select: { code: true } },
          actionOwner: { select: { name: true } }
        }
      }),
      
      // 18. SLA Adherence - tasks completed in current quarter on or before due date
      (async () => {
        // Need raw query for date comparison
        const onTimeCount = await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int as count
          FROM "Task"
          WHERE status = 'COMPLETED'
            AND "completedAt" >= ${startOfQuarterDate}
            AND "completedAt" <= ${nowInUserTz}
            AND "dueDate" IS NOT NULL
            AND "completedAt" <= "dueDate"
            ${!isGroupView ? Prisma.raw(`AND "entityId" = '${entityIdParam}'`) : Prisma.raw('')}
            ${isGroupView ? Prisma.raw(`AND "entityId" IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
        `;
        
        const completedInQuarter = await prisma.task.count({
          where: {
            ...baseTaskFilter,
            status: "COMPLETED",
            completedAt: {
              gte: startOfQuarterDate,
              lte: nowInUserTz
            },
            dueDate: { not: null }
          }
        });
        
        return {
          total: completedInQuarter,
          onTime: onTimeCount[0]?.count || 0
        };
      })(),
      
      // 19. Average completion time - days from IN_PROGRESS to COMPLETED for current quarter
      prisma.$queryRaw<Array<{ avgDays: number | null }>>`
        SELECT AVG(EXTRACT(DAY FROM ("completedAt" - "createdAt")))::numeric as "avgDays"
        FROM "Task"
        WHERE status = 'COMPLETED'
          AND "completedAt" >= ${startOfQuarterDate}
          AND "completedAt" <= ${nowInUserTz}
          AND "createdAt" IS NOT NULL
          ${!isGroupView ? Prisma.raw(`AND "entityId" = '${entityIdParam}'`) : Prisma.raw('')}
          ${isGroupView ? Prisma.raw(`AND "entityId" IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
      `,
      
      // 20. Regulatory coverage - count of active sources and clauses
      (async () => {
        const [activeSources, totalClauses, entitiesWithSources] = await Promise.all([
          prisma.source.count({
            where: {
              status: "ACTIVE",
              entities: {
                some: {
                  entityId: isGroupView 
                    ? { in: session.user.entityIds || [] }
                    : entityIdParam
                }
              }
            }
          }),
          
          prisma.sourceItem.count({
            where: {
              source: {
                status: "ACTIVE",
                entities: {
                  some: {
                    entityId: isGroupView 
                      ? { in: session.user.entityIds || [] }
                      : entityIdParam
                  }
                }
              }
            }
          }),
          
          prisma.sourceEntity.findMany({
            where: {
              entityId: isGroupView 
                ? { in: session.user.entityIds || [] }
                : entityIdParam,
              source: { status: "ACTIVE" }
            },
            distinct: ["entityId"],
            select: { entityId: true }
          })
        ]);
        
        return {
          activeSources,
          totalClauses,
          entitiesCount: entitiesWithSources.length
        };
      })(),
      
      // 21. Compliance posture by source - richer view with progress and findings
      prisma.$queryRaw`
        SELECT 
          s.id as "sourceId",
          s.name as "sourceName",
          s."sourceType",
          ARRAY_AGG(DISTINCT e.code ORDER BY e.code) as "entityCodes",
          COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END)::int as total,
          COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' AND t."dueDate" <= ${startOfTodayUTC} THEN t.id END)::int as completed,
          COUNT(DISTINCT CASE WHEN t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE') 
                AND t."dueDate" < ${startOfTodayUTC} THEN t.id END)::int as overdue,
          COUNT(DISTINCT CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS') THEN f.id END)::int as "openFindings",
          COUNT(DISTINCT CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS') AND f.severity IN ('CRITICAL', 'HIGH') THEN f.id END)::int as "highFindings"
        FROM "Source" s
        INNER JOIN "SourceEntity" se ON se."sourceId" = s.id
        INNER JOIN "Entity" e ON se."entityId" = e.id
        LEFT JOIN "Task" t ON t."sourceId" = s.id AND t."entityId" = e.id
        LEFT JOIN "Finding" f ON f."sourceId" = s.id AND f."entityId" = e.id
        WHERE s.status = 'ACTIVE'
          ${!isGroupView ? Prisma.raw(`AND e.id = '${entityIdParam}'`) : Prisma.raw('')}
          ${isGroupView ? Prisma.raw(`AND e.id IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
        GROUP BY s.id, s.name, s."sourceType"
        ORDER BY 
          COUNT(DISTINCT CASE WHEN t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE') 
                AND t."dueDate" < ${startOfTodayUTC} THEN t.id END) DESC,
          COUNT(DISTINCT CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS') AND f.severity IN ('CRITICAL', 'HIGH') THEN f.id END) DESC,
          CASE 
            WHEN COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END) = 0 THEN 1
            ELSE COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' AND t."dueDate" <= ${startOfTodayUTC} THEN t.id END)::float / 
                 COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END)::float
          END ASC
      ` as Promise<Array<{
        sourceId: string;
        sourceName: string;
        sourceType: string;
        entityCodes: string[];
        total: number;
        completed: number;
        overdue: number;
        openFindings: number;
        highFindings: number;
      }>>,
      
      // 22. Upcoming deadlines - tasks due in next 14 days
      prisma.task.findMany({
        where: {
          ...baseTaskFilter,
          status: { notIn: ["COMPLETED", "PLANNED", "DEFERRED", "NOT_APPLICABLE"] },
          dueDate: {
            gte: startOfTodayUTC,
            lte: subDays(startOfTodayUTC, -14) // 14 days from today
          }
        },
        orderBy: { dueDate: "asc" },
        take: 10,
        include: {
          entity: { select: { code: true } },
          pic: { select: { name: true } }
        }
      }),

      // 23. Monitoring area posture
      prisma.$queryRaw<Array<{
        monitoringAreaId: string | null;
        monitoringAreaName: string | null;
        total: number;
        completed: number;
        overdue: number;
      }>>`
        SELECT
          ma.id as "monitoringAreaId",
          ma.name as "monitoringAreaName",
          COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END)::int as total,
          COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' AND t."dueDate" <= ${startOfTodayUTC} THEN t.id END)::int as completed,
          COUNT(DISTINCT CASE WHEN t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE')
                AND t."dueDate" < ${startOfTodayUTC} THEN t.id END)::int as overdue
        FROM "MonitoringArea" ma
        LEFT JOIN "Task" t ON t."monitoringAreaId" = ma.id
          ${!isGroupView ? Prisma.raw(`AND t."entityId" = '${entityIdParam}'`) : Prisma.raw('')}
          ${isGroupView ? Prisma.raw(`AND t."entityId" IN (SELECT UNNEST(ARRAY[${session.user.entityIds?.map(id => `'${id}'`).join(',')}]::text[]))`) : Prisma.raw('')}
        WHERE ma."isActive" = true
        GROUP BY ma.id, ma.name
        HAVING COUNT(DISTINCT t.id) > 0
        ORDER BY 
          CASE WHEN COUNT(DISTINCT t.id) > 0 
            THEN CAST(COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' THEN t.id END) AS FLOAT) / COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END)
            ELSE 0
          END ASC
        LIMIT 10
      `
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
    
    // Calculate open findings by severity
    const findingsBySeverity = openFindings.reduce((acc: Record<string, number>, item) => {
      acc[item.severity] = item.count;
      return acc;
    }, {});
    
    const totalOpenFindings = openFindings.reduce((sum, item) => sum + item.count, 0);
    const criticalHighFindings = (findingsBySeverity['CRITICAL'] || 0) + (findingsBySeverity['HIGH'] || 0);
    
    // Calculate SLA adherence percentage
    const slaAdherence = slaAdherenceData.total > 0
      ? Math.round((slaAdherenceData.onTime / slaAdherenceData.total) * 100)
      : 0;
    
    // Calculate average completion time in days
    const avgCompletionDays = avgCompletionData[0]?.avgDays 
      ? Math.round(Number(avgCompletionData[0].avgDays))
      : null;

    // Format action items
    const formattedActionItems = actionItems.map(task => ({
      id: task.id,
      name: task.name,
      entityCode: task.entity.code,
      status: task.status,
      dueDate: task.dueDate,
      sourceName: task.source?.name || "Unknown Source",
      isOverdue: task.dueDate ? task.dueDate < startOfTodayUTC : false,
      recurrenceGroupId: task.recurrenceGroupId
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
    
    // Format findings overview - sort by severity
    const severityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, OBSERVATION: 5 };
    const formattedFindings = openFindingsTopList
      .sort((a, b) => {
        const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
        if (severityDiff !== 0) return severityDiff;
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      })
      .map(finding => {
        const daysOpen = Math.floor((nowInUserTz.getTime() - new Date(finding.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: finding.id,
          reference: finding.reference,
          title: finding.title,
          severity: finding.severity,
          entityCode: finding.entity.code,
          actionOwner: finding.actionOwner.name,
          targetDate: finding.targetDate,
          daysOpen
        };
      });
    
    // Format upcoming deadlines
    const formattedUpcomingDeadlines = upcomingDeadlines.map(task => ({
      id: task.id,
      name: task.name,
      entityCode: task.entity.code,
      dueDate: task.dueDate,
      picName: task.pic?.name || "Unassigned",
      daysUntilDue: task.dueDate
        ? Math.floor((new Date(task.dueDate).getTime() - startOfTodayUTC.getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

    // Format monitoring area posture
    const formattedMonitoringAreaPosture = monitoringAreaPosture.map(area => ({
      monitoringAreaId: area.monitoringAreaId,
      monitoringAreaName: area.monitoringAreaName || "Uncategorized",
      total: area.total,
      completed: area.completed,
      overdue: area.overdue,
      completionPct: area.total > 0 ? Math.round((area.completed / area.total) * 100) : 0
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
        quarterCompletionPrevWeek: quarterCompletionLastWeek,
        openFindings: totalOpenFindings,
        criticalHighFindings,
        slaAdherence,
        avgCompletionDays,
        activeSources: regulatoryCoverage.activeSources,
        totalClauses: regulatoryCoverage.totalClauses,
        entitiesCount: regulatoryCoverage.entitiesCount
      },
      actionItems: formattedActionItems,
      completionTrend: completionTrendData,
      entityComparison: isGroupView ? formattedEntityComparison : null,
      teamWorkload: !isGroupView ? teamWorkload : null,
      sourcesNeedingAttention,
      statusByRiskRating,
      findingsOverview: formattedFindings,
      compliancePosture,
      upcomingDeadlines: formattedUpcomingDeadlines,
      monitoringAreaPosture: formattedMonitoringAreaPosture
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
