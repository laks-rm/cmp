import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "READ");

    const sourceId = context.params.id;

    // Verify source exists and user has access
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: { entities: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const sourceEntityIds = source.entities.map((e) => e.entityId);
    const hasAccess = sourceEntityIds.some((id) =>
      session.user.entityIds.includes(id)
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch all items for this source, ordered by sortOrder
    const items = await prisma.sourceItem.findMany({
      where: { sourceId },
      orderBy: [{ sortOrder: "asc" }, { reference: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching source items:", error);
    return NextResponse.json(
      { error: "Failed to fetch source items" },
      { status: 500 }
    );
  }
}
