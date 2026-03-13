import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.roleName !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requirePermission(session, "SYSTEM_MONITORING", "VIEW");

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get error counts by time period
    const [total24h, total7d, total30d, unresolved, byType, bySeverity] = await Promise.all([
      prisma.errorLog.count({
        where: { createdAt: { gte: last24h } },
      }),
      prisma.errorLog.count({
        where: { createdAt: { gte: last7d } },
      }),
      prisma.errorLog.count({
        where: { createdAt: { gte: last30d } },
      }),
      prisma.errorLog.count({
        where: { resolved: false },
      }),
      prisma.errorLog.groupBy({
        by: ["errorType"],
        _count: true,
        orderBy: { _count: { errorType: "desc" } },
        take: 5,
      }),
      prisma.errorLog.groupBy({
        by: ["severity"],
        _count: true,
      }),
    ]);

    // Get error trend for last 7 days
    const trendData = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int as count
      FROM "ErrorLog"
      WHERE created_at >= ${last7d}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const trend = trendData.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      count: Number(item.count),
    }));

    // Get most affected users
    const topUsers = await prisma.errorLog.groupBy({
      by: ["userId"],
      where: {
        userId: { not: null },
        createdAt: { gte: last7d },
      },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    });

    const usersWithDetails = await Promise.all(
      topUsers.map(async (item) => {
        if (!item.userId) return null;
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { id: true, name: true, email: true },
        });
        return {
          user,
          count: item._count,
        };
      })
    );

    return NextResponse.json({
      counts: {
        last24h: total24h,
        last7d: total7d,
        last30d: total30d,
        unresolved,
      },
      byType: byType.map((item) => ({
        type: item.errorType,
        count: item._count,
      })),
      bySeverity: bySeverity.map((item) => ({
        severity: item.severity,
        count: item._count,
      })),
      trend,
      topUsers: usersWithDetails.filter((item) => item !== null),
    });
  } catch (error) {
    console.error("Error fetching error stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch error stats" },
      { status: 500 }
    );
  }
}
