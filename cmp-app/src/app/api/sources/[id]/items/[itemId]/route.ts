import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const updateItemSchema = z.object({
  reference: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  isInformational: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "EDIT");

    const sourceId = context.params.id;
    const itemId = context.params.itemId;
    const body = await req.json();
    const data = updateItemSchema.parse(body);

    // Verify source exists and user has access
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: {
        entities: {
          select: {
            entityId: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Check if user has access to at least one entity of the source
    const hasAccess = source.entities.some((e) =>
      session.user.entityIds.includes(e.entityId)
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify item exists and belongs to source
    const existingItem = await prisma.sourceItem.findUnique({
      where: { id: itemId },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.sourceId !== sourceId) {
      return NextResponse.json(
        { error: "Item does not belong to this source" },
        { status: 400 }
      );
    }

    // Check if reference is being changed and if it's unique within the source
    if (data.reference && data.reference !== existingItem.reference) {
      const duplicateItem = await prisma.sourceItem.findFirst({
        where: {
          sourceId,
          reference: data.reference,
          id: { not: itemId },
        },
      });

      if (duplicateItem) {
        return NextResponse.json(
          { error: "Reference already exists in this source" },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.reference !== undefined) updates.reference = data.reference;
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.isInformational !== undefined)
      updates.isInformational = data.isInformational;

    const updatedItem = await prisma.sourceItem.update({
      where: { id: itemId },
      data: updates,
    });

    await logAuditEvent({
      action: "SOURCE_ITEM_UPDATED",
      module: "SOURCES",
      userId: session.user.userId,
      entityId: session.user.entityIds[0],
      targetType: "SourceItem",
      targetId: itemId,
      details: {
        sourceId,
        changes: updates as Record<string, string | boolean | null>,
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("PATCH /api/sources/[id]/items/[itemId] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
