import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { ApiError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "AUDIT_LOG", "VIEW");

    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");
    const moduleFilter = searchParams.get("module");
    const userId = searchParams.get("userId");
    const entityId = searchParams.get("entityId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const exportFormat = searchParams.get("export");

    const where: Record<string, unknown> = {};

    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (moduleFilter) where.module = moduleFilter;
    if (userId) where.userId = userId;

    // Entity access control
    if (entityId) {
      where.entityId = entityId;
    } else {
      // Filter by user's accessible entities
      where.OR = [
        { entityId: { in: session.user.entityIds } },
        { entityId: null }, // System-wide events
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = endDate;
      }
    }

    // CSV Export
    if (exportFormat === "csv") {
      const allEntries = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const csv = generateAuditCSV(allEntries);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
        },
      });
    }

    // Paginated response
    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Audit log fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}

function generateAuditCSV(entries: Array<{
  createdAt: string | Date;
  user: { name: string; email: string };
  module: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  details: Prisma.JsonValue;
}>): string {
  const headers = ["Timestamp", "User", "Module", "Action", "Target Type", "Target ID", "IP Address", "Details"];

  const rows = entries.map((entry) => [
    new Date(entry.createdAt).toISOString(),
    escapeCSV(entry.user.name),
    escapeCSV(entry.module),
    escapeCSV(entry.action),
    escapeCSV(entry.targetType || ""),
    escapeCSV(entry.targetId || ""),
    escapeCSV(entry.ipAddress || ""),
    escapeCSV(entry.details ? JSON.stringify(entry.details) : ""),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
