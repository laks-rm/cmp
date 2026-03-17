import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { updateSourceSchema } from "@/lib/validations/sources";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "VIEW");

    const sourceId = context.params.id;

    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        team: true,
        entities: {
          include: {
            entity: true,
          },
        },
        items: {
          include: {
            tasks: {
              include: {
                entity: true,
                assignee: {
                  select: {
                    id: true,
                    name: true,
                    initials: true,
                    avatarColor: true,
                  },
                },
                pic: {
                  select: {
                    id: true,
                    name: true,
                    initials: true,
                    avatarColor: true,
                  },
                },
              },
            },
            parent: true,
            children: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Check entity access
    const sourceEntityIds = source.entities.map((e: { entityId: string }) => e.entityId);
    const hasAccess = sourceEntityIds.some((id: string) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(source);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch source" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "EDIT");

    const sourceId = context.params.id;
    const body = await req.json();
    const validatedData = updateSourceSchema.parse(body);

    const existingSource = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        entities: true,
      },
    });

    if (!existingSource) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Check entity access
    const sourceEntityIds = existingSource.entities.map((e: { entityId: string }) => e.entityId);
    const hasAccess = sourceEntityIds.some((id: string) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.code) updateData.code = validatedData.code;
    if (validatedData.sourceType) updateData.sourceType = validatedData.sourceType;
    if (validatedData.issuingAuthorityId !== undefined) updateData.issuingAuthorityId = validatedData.issuingAuthorityId;
    if (validatedData.effectiveDate) updateData.effectiveDate = new Date(validatedData.effectiveDate);
    if (validatedData.reviewDate) updateData.reviewDate = new Date(validatedData.reviewDate);
    if (validatedData.status) updateData.status = validatedData.status;

    // Handle entity updates
    if (validatedData.entityIds) {
      // Remove old entity links
      await prisma.sourceEntity.deleteMany({
        where: { sourceId },
      });
      // Create new entity links
      updateData.entities = {
        create: validatedData.entityIds.map((entityId) => ({
          entityId,
        })),
      };
    }

    const updatedSource = await prisma.source.update({
      where: { id: sourceId },
      data: updateData,
      include: {
        team: true,
        entities: {
          include: {
            entity: true,
          },
        },
      },
    });

    await logAuditEvent({
      action: "SOURCE_UPDATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "Source",
      targetId: sourceId,
      details: validatedData,
    });

    return NextResponse.json(updatedSource);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A source with this code already exists for this team" }, { status: 409 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source update error:", error);
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }
}
