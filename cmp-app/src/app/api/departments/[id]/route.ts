import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

const updateDepartmentSchema = z.object({
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

    const department = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        teams: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        _count: {
          select: { teams: true },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json({ department });
  } catch (error) {
    console.error("GET /api/departments/[id] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 });
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

    const canEdit = await hasPermission(session, "TEAM_CONFIG", "EDIT");
    if (!canEdit) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateDepartmentSchema.parse(body);

    if (validated.name) {
      const existing = await prisma.department.findFirst({
        where: {
          name: validated.name,
          id: { not: params.id },
        },
      });

      if (existing) {
        return NextResponse.json({ error: "A department with this name already exists" }, { status: 400 });
      }
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
      },
    });

    await logAuditEvent({
      action: "DEPARTMENT_UPDATED",
      module: "TEAM_CONFIG",
      userId: session.user.userId,
      targetType: "Department",
      targetId: department.id,
      details: validated,
    });

    return NextResponse.json({ department });
  } catch (error) {
    console.error("PATCH /api/departments/[id] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
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

    const canDelete = await hasPermission(session, "TEAM_CONFIG", "DELETE");
    if (!canDelete) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await logAuditEvent({
      action: "DEPARTMENT_DEACTIVATED",
      module: "TEAM_CONFIG",
      userId: session.user.userId,
      targetType: "Department",
      targetId: department.id,
      details: { name: department.name },
    });

    return NextResponse.json({ department });
  } catch (error) {
    console.error("DELETE /api/departments/[id] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to deactivate department" }, { status: 500 });
  }
}
