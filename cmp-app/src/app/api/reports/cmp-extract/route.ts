import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { ApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "REPORTS", "EXPORT");

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const entityId = searchParams.get("entityId");
    const period = searchParams.get("period");
    const sourceId = searchParams.get("sourceId");

    // Build where clause
    const where: Record<string, unknown> = {
      entityId: entityId || { in: session.user.entityIds },
    };

    if (sourceId) {
      where.sourceId = sourceId;
    }

    // Parse period filter (e.g., "Q1-2026")
    if (period && period !== "all") {
      const [quarter, year] = period.split("-");
      if (quarter && year) {
        where.quarter = quarter;
        // Optionally filter by year in dueDate
        const yearNum = parseInt(year);
        if (!isNaN(yearNum)) {
          where.dueDate = {
            gte: new Date(`${yearNum}-01-01`),
            lt: new Date(`${yearNum + 1}-01-01`),
          };
        }
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        entity: true,
        source: true,
        sourceItem: true,
        assignee: {
          select: {
            name: true,
            email: true,
          },
        },
        pic: {
          select: {
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            name: true,
            email: true,
          },
        },
        evidence: {
          select: {
            id: true,
          },
        },
        findings: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ source: { name: "asc" } }, { name: "asc" }],
    });

    if (format === "csv") {
      const csv = generateCSV(tasks);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cmp-extract-${Date.now()}.csv"`,
        },
      });
    }

    if (format === "xlsx") {
      // For MVP, return CSV with xlsx extension
      // TODO: Use xlsx/SheetJS library for true Excel format with styling
      const csv = generateCSV(tasks);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="cmp-extract-${Date.now()}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      // TODO: Implement PDF generation with @react-pdf/renderer or puppeteer
      // For MVP, return JSON with instructions
      return NextResponse.json({
        error: "PDF export coming soon",
        suggestion: "Use CSV or Excel format for now",
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("CMP Extract error:", error);
    return NextResponse.json({ error: "Failed to generate extract" }, { status: 500 });
  }
}

function generateCSV(tasks: Array<{
  entity: { name: string };
  source: { name: string; sourceType: string };
  sourceItem?: { reference: string } | null;
  name: string;
  description: string | null;
  expectedOutcome: string | null;
  status: string;
  riskRating: string;
  frequency: string;
  quarter: string | null;
  assignee?: { name: string } | null;
  pic?: { name: string } | null;
  reviewer?: { name: string } | null;
  dueDate: Date | null;
  completedAt: Date | null;
  evidence: Array<{ id: string }>;
  narrative: string | null;
  findings: Array<{ id: string }>;
}>): string {
  const headers = [
    "Entity",
    "Source",
    "Source Type",
    "Article/Clause Reference",
    "Task Name",
    "Description",
    "Expected Outcome",
    "Status",
    "Risk Rating",
    "Frequency",
    "Quarter",
    "Department / Team Responsible",
    "Person in Charge (PIC)",
    "Reviewer",
    "Due Date",
    "Completed Date",
    "Evidence Count",
    "Narrative",
    "Findings Count",
  ];

  const rows = tasks.map((task) => [
    escapeCSV(task.entity.name),
    escapeCSV(task.source.name),
    escapeCSV(task.source.sourceType),
    escapeCSV(task.sourceItem?.reference || ""),
    escapeCSV(task.name),
    escapeCSV(task.description || ""),
    escapeCSV(task.expectedOutcome || ""),
    escapeCSV(task.status),
    escapeCSV(task.riskRating),
    escapeCSV(task.frequency),
    escapeCSV(task.quarter || ""),
    escapeCSV(task.assignee?.name || ""),
    escapeCSV(task.pic?.name || ""),
    escapeCSV(task.reviewer?.name || ""),
    task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    task.completedAt ? new Date(task.completedAt).toISOString().split("T")[0] : "",
    task.evidence.length.toString(),
    escapeCSV(task.narrative || ""),
    task.findings.length.toString(),
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  return csvContent;
}

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
