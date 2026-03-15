import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { z } from "zod";

const updateErrorSchema = z.object({
  resolved: z.boolean().optional(),
  resolutionNotes: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.roleName !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requirePermission(session, "SYSTEM_MONITORING", "VIEW");

    const errorLog = await prisma.errorLog.findUnique({
      where: { id: context.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
            role: {
              select: {
                displayName: true,
              },
            },
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!errorLog) {
      return NextResponse.json({ error: "Error log not found" }, { status: 404 });
    }

    return NextResponse.json(errorLog);
  } catch (error) {
    console.error("Error fetching error log:", error);
    return NextResponse.json(
      { error: "Failed to fetch error log" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.roleName !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requirePermission(session, "SYSTEM_MONITORING", "EDIT");

    const body = await req.json();
    const data = updateErrorSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.resolved !== undefined) {
      updateData.resolved = data.resolved;
      if (data.resolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = session.user.userId;
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedById = null;
      }
    }

    if (data.resolutionNotes !== undefined) {
      updateData.resolutionNotes = data.resolutionNotes;
    }

    const errorLog = await prisma.errorLog.update({
      where: { id: context.params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
        resolver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(errorLog);
  } catch (error) {
    console.error("Error updating error log:", error);
    return NextResponse.json(
      { error: "Failed to update error log" },
      { status: 500 }
    );
  }
}
