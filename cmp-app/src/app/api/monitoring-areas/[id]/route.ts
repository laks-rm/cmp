import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

const updateMonitoringAreaSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monitoringArea = await prisma.monitoringArea.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!monitoringArea) {
      return NextResponse.json({ error: "Monitoring area not found" }, { status: 404 });
    }

    return NextResponse.json({ monitoringArea });
  } catch (error) {
    console.error("GET /api/monitoring-areas/[id] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch monitoring area" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canEdit = await hasPermission(session, "SOURCES", "EDIT");
    if (!canEdit) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateMonitoringAreaSchema.parse(body);

    if (validated.name) {
      const existing = await prisma.monitoringArea.findFirst({
        where: {
          name: validated.name,
          id: { not: params.id },
        },
      });

      if (existing) {
        return NextResponse.json({ error: "A monitoring area with this name already exists" }, { status: 400 });
      }
    }

    const monitoringArea = await prisma.monitoringArea.update({
      where: { id: params.id },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
      },
    });

    await logAuditEvent({
      action: "MONITORING_AREA_UPDATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "MonitoringArea",
      targetId: monitoringArea.id,
      details: validated,
    });

    return NextResponse.json({ monitoringArea });
  } catch (error) {
    console.error("PATCH /api/monitoring-areas/[id] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update monitoring area" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canDelete = await hasPermission(session, "SOURCES", "DELETE");
    if (!canDelete) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const monitoringArea = await prisma.monitoringArea.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await logAuditEvent({
      action: "MONITORING_AREA_DEACTIVATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "MonitoringArea",
      targetId: monitoringArea.id,
      details: { name: monitoringArea.name },
    });

    return NextResponse.json({ monitoringArea });
  } catch (error) {
    console.error("DELETE /api/monitoring-areas/[id] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to deactivate monitoring area" }, { status: 500 });
  }
}
