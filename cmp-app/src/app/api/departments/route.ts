import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

const createDepartmentSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: {
          select: { teams: true },
        },
      },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error("GET /api/departments error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const validated = createDepartmentSchema.parse(body);

    const existing = await prisma.department.findUnique({
      where: { name: validated.name },
    });

    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 400 });
    }

    const department = await prisma.department.create({
      data: {
        name: validated.name,
        description: validated.description || null,
      },
    });

    await logAuditEvent({
      action: "DEPARTMENT_CREATED",
      module: "TEAM_CONFIG",
      userId: session.user.userId,
      targetType: "Department",
      targetId: department.id,
      details: { name: department.name },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("POST /api/departments error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
