import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

const createMonitoringAreaSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monitoringAreas = await prisma.monitoringArea.findMany({
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

    return NextResponse.json({ monitoringAreas });
  } catch (error) {
    console.error("GET /api/monitoring-areas error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch monitoring areas" }, { status: 500 });
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
    const validated = createMonitoringAreaSchema.parse(body);

    const existing = await prisma.monitoringArea.findUnique({
      where: { name: validated.name },
    });

    if (existing) {
      return NextResponse.json({ error: "A monitoring area with this name already exists" }, { status: 400 });
    }

    const monitoringArea = await prisma.monitoringArea.create({
      data: {
        name: validated.name,
        description: validated.description || null,
      },
    });

    await logAuditEvent({
      action: "MONITORING_AREA_CREATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "MonitoringArea",
      targetId: monitoringArea.id,
      details: { name: monitoringArea.name },
    });

    return NextResponse.json({ monitoringArea }, { status: 201 });
  } catch (error) {
    console.error("POST /api/monitoring-areas error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create monitoring area" }, { status: 500 });
  }
}
