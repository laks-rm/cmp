import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createSourceItemSchema } from "@/lib/validations/sources";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "EDIT");

    const body = await req.json();
    const validatedData = createSourceItemSchema.parse(body);

    // Verify source access
    const source = await prisma.source.findUnique({
      where: { id: validatedData.sourceId },
      include: { entities: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const sourceEntityIds = source.entities.map((e: { entityId: string }) => e.entityId);
    const hasAccess = sourceEntityIds.some((id: string) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const item = await prisma.sourceItem.create({
      data: validatedData,
      include: {
        parent: true,
        tasks: true,
      },
    });

    await logAuditEvent({
      action: "SOURCE_ITEM_CREATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "SourceItem",
      targetId: item.id,
      details: {
        sourceId: validatedData.sourceId,
        reference: validatedData.reference,
        title: validatedData.title,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source item creation error:", error);
    return NextResponse.json({ error: "Failed to create source item" }, { status: 500 });
  }
}
