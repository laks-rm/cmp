import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { ApiError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

type AuditLogWithRelations = {
  id: string;
  action: string;
  module: string;
  userId: string;
  targetType: string | null;
  targetId: string | null;
  details: Prisma.JsonValue;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    name: string;
    email: string;
  };
};

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
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

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

      const enrichedEntries = await enrichAuditEntries(allEntries);
      const csv = generateAuditCSV(enrichedEntries);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
        },
      });
    }

    // Paginated response
    const orderByField = sortBy === "user" ? "userId" : sortBy;
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
        orderBy: { [orderByField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Enrich entries with target names and change summaries
    const enrichedEntries = await enrichAuditEntries(entries);

    return NextResponse.json({
      entries: enrichedEntries,
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

async function enrichAuditEntries(entries: AuditLogWithRelations[]) {
  // Collect all target IDs by type
  const taskIds = new Set<string>();
  const findingIds = new Set<string>();
  const sourceIds = new Set<string>();

  entries.forEach((entry) => {
    if (entry.targetId) {
      if (entry.targetType === "TASK") taskIds.add(entry.targetId);
      else if (entry.targetType === "FINDING") findingIds.add(entry.targetId);
      else if (entry.targetType === "SOURCE") sourceIds.add(entry.targetId);
    }
  });

  // Fetch all targets in parallel
  const [tasks, findings, sources] = await Promise.all([
    taskIds.size > 0
      ? prisma.task.findMany({
          where: { id: { in: Array.from(taskIds) } },
          select: { id: true, name: true },
        })
      : [],
    findingIds.size > 0
      ? prisma.finding.findMany({
          where: { id: { in: Array.from(findingIds) } },
          select: { id: true, reference: true, title: true },
        })
      : [],
    sourceIds.size > 0
      ? prisma.source.findMany({
          where: { id: { in: Array.from(sourceIds) } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  // Create lookup maps
  const taskMap = new Map(tasks.map((t) => [t.id, t.name]));
  const findingMap = new Map(findings.map((f) => [f.id, `${f.reference} - ${f.title}`]));
  const sourceMap = new Map(sources.map((s) => [s.id, s.name]));

  // Enrich entries
  return entries.map((entry) => {
    let targetName: string | null = null;

    if (entry.targetId && entry.targetType) {
      if (entry.targetType === "TASK") {
        targetName = taskMap.get(entry.targetId) || entry.targetId;
      } else if (entry.targetType === "FINDING") {
        targetName = findingMap.get(entry.targetId) || entry.targetId;
      } else if (entry.targetType === "SOURCE") {
        targetName = sourceMap.get(entry.targetId) || entry.targetId;
      }
    }

    const changeSummary = generateChangeSummary(entry.action, entry.details);

    return {
      ...entry,
      targetName,
      changeSummary,
    };
  });
}

function generateChangeSummary(action: string, details: Prisma.JsonValue): string {
  if (!details || typeof details !== "object" || details === null) {
    return "—";
  }

  const detailsObj = details as Record<string, unknown>;

  // Status change
  if (action === "task_status_changed" || action === "finding_status_changed") {
    const from = detailsObj.from;
    const to = detailsObj.to;
    if (from && to) {
      return `${String(from).replace(/_/g, " ")} → ${String(to).replace(/_/g, " ")}`;
    }
  }

  // PIC assignment
  if (action === "task_pic_assigned" || action === "finding_pic_assigned") {
    const from = detailsObj.from;
    const to = detailsObj.to;
    if (from && to) {
      return `${from} → ${to}`;
    } else if (to) {
      return `Assigned to ${to}`;
    } else if (from) {
      return `Unassigned from ${from}`;
    }
  }

  // Narrative/description updates
  if (action === "task_narrative_updated" || action === "finding_narrative_updated") {
    return "Narrative updated";
  }

  // Evidence uploads
  if (action === "evidence_uploaded") {
    const filename = detailsObj.filename || detailsObj.fileName;
    if (filename) {
      return `Uploaded: ${filename}`;
    }
    return "Evidence uploaded";
  }

  // Priority changes
  if (action === "task_priority_changed" || action === "finding_priority_changed") {
    const from = detailsObj.from;
    const to = detailsObj.to;
    if (from && to) {
      return `${from} → ${to}`;
    }
  }

  // Due date changes
  if (action === "task_due_date_changed") {
    const to = detailsObj.to;
    if (to) {
      return `Due date: ${to}`;
    }
  }

  // Generic changes with before/after
  if (detailsObj.from && detailsObj.to) {
    return `${detailsObj.from} → ${detailsObj.to}`;
  }

  // If details exist but no specific mapping
  if (Object.keys(detailsObj).length > 0) {
    return "Updated";
  }

  return "—";
}

function generateAuditCSV(entries: Array<{
  createdAt: string | Date;
  user: { name: string; email: string };
  module: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName?: string | null;
  changeSummary?: string;
  ipAddress: string | null;
  details: Prisma.JsonValue;
}>): string {
  const headers = ["Timestamp", "User", "Module", "Action", "Target Type", "Target Name", "Change", "IP Address", "Details"];

  const rows = entries.map((entry) => [
    new Date(entry.createdAt).toISOString(),
    escapeCSV(entry.user.name),
    escapeCSV(entry.module),
    escapeCSV(entry.action),
    escapeCSV(entry.targetType || ""),
    escapeCSV(entry.targetName || entry.targetId || ""),
    escapeCSV(entry.changeSummary || ""),
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
