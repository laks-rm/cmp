import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const updateTeamSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).trim().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  approvalRequired: z.boolean().optional(),
  evidenceRequired: z.boolean().optional(),
  narrativeRequired: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "VIEW");

    const teams = await prisma.team.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        approvalRequired: true,
        evidenceRequired: true,
        narrativeRequired: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Teams fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canEdit = await hasPermission(session, "TEAM_CONFIG", "EDIT");
    if (!canEdit) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateTeamSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.departmentId !== undefined) updateData.departmentId = validated.departmentId;
    if (validated.approvalRequired !== undefined) updateData.approvalRequired = validated.approvalRequired;
    if (validated.evidenceRequired !== undefined) updateData.evidenceRequired = validated.evidenceRequired;
    if (validated.narrativeRequired !== undefined) updateData.narrativeRequired = validated.narrativeRequired;

    const team = await prisma.team.update({
      where: { id: validated.teamId },
      data: updateData,
    });

    await logAuditEvent({
      action: "TEAM_UPDATED",
      module: "TEAM_CONFIG",
      userId: session.user.userId,
      targetType: "Team",
      targetId: team.id,
      details: validated,
    });

    return NextResponse.json({ team });
  } catch (error) {
    console.error("PATCH /api/teams error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}
