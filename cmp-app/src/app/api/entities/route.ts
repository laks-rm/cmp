import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "VIEW");

    // Return only entities the user has access to
    const entities = await prisma.entity.findMany({
      where: {
        isActive: true,
        ...(session.user.entityIds.length > 0 && {
          id: { in: session.user.entityIds },
        }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        jurisdiction: true,
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json(entities);
  } catch (error) {
    console.error("Entities fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch entities" }, { status: 500 });
  }
}
