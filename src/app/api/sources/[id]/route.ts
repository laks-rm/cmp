import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { editSourceMetadataSchema } from "@/lib/validations/sources";
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

/**
 * PATCH /api/sources/[id]
 * 
 * Conservative source editing endpoint with entity change detection.
 * 
 * Behavior:
 * 1. Simple metadata edits (name, description) are applied immediately
 * 2. Entity additions are detected and impact summary is returned
 * 3. Entity removals are flagged with warnings
 * 4. Does NOT automatically generate tasks for new entities
 * 5. Preserves all existing task history
 */
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "EDIT");

    const sourceId = context.params.id;
    const body = await req.json();
    const validatedData = editSourceMetadataSchema.parse(body);

    // Fetch existing source with entities and items
    const existingSource = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        entities: {
          include: {
            entity: true,
          },
        },
        items: {
          include: {
            tasks: {
              where: { deletedAt: null },
              select: {
                id: true,
                entityId: true,
                status: true,
                recurrenceGroupId: true,
              },
            },
          },
        },
      },
    });

    if (!existingSource) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Check entity access
    const sourceEntityIds = existingSource.entities.map((e) => e.entityId);
    const hasAccess = sourceEntityIds.some((id) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Detect entity changes
    const oldEntityIds = new Set(sourceEntityIds);
    const newEntityIds = validatedData.entityIds ? new Set(validatedData.entityIds) : oldEntityIds;

    const addedEntityIds = validatedData.entityIds 
      ? validatedData.entityIds.filter((id) => !oldEntityIds.has(id))
      : [];
    const removedEntityIds = Array.from(oldEntityIds).filter((id) => !newEntityIds.has(id));

    // Check if any added entities are new to the user's access
    if (addedEntityIds.length > 0) {
      const hasAccessToNewEntities = addedEntityIds.every((id) =>
        session.user.entityIds.includes(id)
      );
      if (!hasAccessToNewEntities) {
        return NextResponse.json(
          { error: "You do not have access to one or more entities you're trying to add" },
          { status: 403 }
        );
      }
    }

    // Build metadata update object (conservative - only what was provided)
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.code !== undefined) updateData.code = validatedData.code;
    if (validatedData.sourceType !== undefined) updateData.sourceType = validatedData.sourceType;
    if (validatedData.issuingAuthorityId !== undefined) {
      updateData.issuingAuthorityId = validatedData.issuingAuthorityId;
    }
    if (validatedData.effectiveDate !== undefined) {
      updateData.effectiveDate = validatedData.effectiveDate ? new Date(validatedData.effectiveDate) : null;
    }
    if (validatedData.reviewDate !== undefined) {
      updateData.reviewDate = validatedData.reviewDate ? new Date(validatedData.reviewDate) : null;
    }

    // Calculate impact summary for entity changes
    let impactSummary = null;
    let removedEntityWarnings = null;

    if (addedEntityIds.length > 0) {
      // Count source items and tasks
      const itemCount = existingSource.items.length;
      
      // Estimate tasks per entity (based on existing task templates)
      // Group tasks by recurrence group or count unique task definitions
      const uniqueTaskTemplates = new Set<string>();
      existingSource.items.forEach((item) => {
        item.tasks.forEach((task) => {
          const templateKey = task.recurrenceGroupId || task.id;
          uniqueTaskTemplates.add(templateKey);
        });
      });

      const estimatedTasksPerEntity = uniqueTaskTemplates.size;

      // Fetch entity details for display
      const newEntities = await prisma.entity.findMany({
        where: { id: { in: addedEntityIds } },
        select: { id: true, code: true, name: true },
      });

      impactSummary = {
        addedEntities: newEntities,
        sourceItemCount: itemCount,
        estimatedTaskTemplates: estimatedTasksPerEntity,
        estimatedTotalTasks: estimatedTasksPerEntity * addedEntityIds.length,
        message: "New entity/entities will be added to source. Tasks can be generated separately.",
      };
    }

    if (removedEntityIds.length > 0) {
      // Check for existing tasks for removed entities
      const tasksForRemovedEntities = await prisma.task.count({
        where: {
          sourceId,
          entityId: { in: removedEntityIds },
          deletedAt: null,
        },
      });

      const removedEntities = await prisma.entity.findMany({
        where: { id: { in: removedEntityIds } },
        select: { id: true, code: true, name: true },
      });

      removedEntityWarnings = {
        removedEntities,
        existingTaskCount: tasksForRemovedEntities,
        warning: tasksForRemovedEntities > 0
          ? `${tasksForRemovedEntities} existing task(s) will remain but will no longer be associated with source scope. Historical data is preserved.`
          : "No existing tasks for removed entities.",
      };
    }

    // Apply entity changes if provided
    if (validatedData.entityIds) {
      updateData.entities = {
        deleteMany: {},
        create: validatedData.entityIds.map((entityId) => ({ entityId })),
      };
    }

    // Perform update
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
        issuingAuthority: true,
      },
    });

    // Audit logging
    const auditDetails: any = {
      updatedFields: Object.keys(updateData),
    };

    if (addedEntityIds.length > 0) {
      auditDetails.addedEntityIds = addedEntityIds;
      await logAuditEvent({
        action: "SOURCE_ENTITY_ADDED",
        module: "SOURCES",
        userId: session.user.userId,
        targetType: "Source",
        targetId: sourceId,
        details: { addedEntityIds, impactSummary },
      });
    }

    if (removedEntityIds.length > 0) {
      auditDetails.removedEntityIds = removedEntityIds;
      await logAuditEvent({
        action: "SOURCE_ENTITY_REMOVED",
        module: "SOURCES",
        userId: session.user.userId,
        targetType: "Source",
        targetId: sourceId,
        details: { removedEntityIds, removedEntityWarnings },
      });
    }

    await logAuditEvent({
      action: "SOURCE_METADATA_UPDATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "Source",
      targetId: sourceId,
      details: auditDetails,
    });

    // Return response with impact summary
    return NextResponse.json({
      source: updatedSource,
      impactSummary,
      removedEntityWarnings,
      message: "Source updated successfully",
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A source with this code already exists for this team" },
        { status: 409 }
      );
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source update error:", error);
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
  }
}
