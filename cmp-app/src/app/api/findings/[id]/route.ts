import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { updateFindingSchema } from "@/lib/validations/findings";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "FINDINGS", "VIEW");

    const findingId = context.params.id;

    const finding = await prisma.finding.findUnique({
      where: { id: findingId },
      include: {
        source: true,
        task: true,
        entity: true,
        actionOwner: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
        evidence: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                initials: true,
                avatarColor: true,
              },
            },
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                initials: true,
                avatarColor: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    if (!session.user.entityIds.includes(finding.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(finding);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Finding fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch finding" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "FINDINGS", "EDIT");

    const findingId = context.params.id;
    const body = await req.json();
    const validatedData = updateFindingSchema.parse(body);

    const existingFinding = await prisma.finding.findUnique({
      where: { id: findingId },
    });

    if (!existingFinding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    if (!session.user.entityIds.includes(existingFinding.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (validatedData.title) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.severity) updateData.severity = validatedData.severity;
    if (validatedData.rootCause !== undefined) updateData.rootCause = validatedData.rootCause;
    if (validatedData.impact !== undefined) updateData.impact = validatedData.impact;
    if (validatedData.managementResponse !== undefined) updateData.managementResponse = validatedData.managementResponse;
    if (validatedData.closureNote !== undefined) updateData.closureNote = validatedData.closureNote;
    if (validatedData.targetDate) updateData.targetDate = new Date(validatedData.targetDate);

    if (validatedData.status) {
      updateData.status = validatedData.status;
      if (validatedData.status === "CLOSED") {
        updateData.closedAt = new Date();
      }
    }

    const updatedFinding = await prisma.finding.update({
      where: { id: findingId },
      data: updateData,
      include: {
        source: true,
        entity: true,
        actionOwner: true,
        raisedBy: true,
      },
    });

    await logAuditEvent({
      action: "FINDING_UPDATED",
      module: "FINDINGS",
      userId: session.user.userId,
      entityId: existingFinding.entityId,
      targetType: "Finding",
      targetId: findingId,
      details: validatedData,
    });

    return NextResponse.json(updatedFinding);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Finding update error:", error);
    return NextResponse.json({ error: "Failed to update finding" }, { status: 500 });
  }
}
