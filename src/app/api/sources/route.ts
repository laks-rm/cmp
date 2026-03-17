import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, getUserEntities } from "@/lib/permissions";
import { createSourceSchema } from "@/lib/validations/sources";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "VIEW");

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status");
    const entityId = searchParams.get("entityId");

    const where: Record<string, unknown> = {};

    if (teamId) where.teamId = teamId;
    if (status) where.status = status;

    // Entity filter
    if (entityId) {
      where.entities = {
        some: { entityId },
      };
    } else if (session.user.entityIds.length > 0) {
      where.entities = {
        some: {
          entityId: { in: session.user.entityIds },
        },
      };
    }

    const sources = await prisma.source.findMany({
      where,
      include: {
        team: true,
        issuingAuthority: true,
        entities: {
          include: {
            entity: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            items: true,
            findings: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate completion stats for each source
    const sourcesWithStats = await Promise.all(
      sources.map(async (source) => {
        const completedCount = await prisma.task.count({
          where: {
            sourceId: source.id,
            status: "COMPLETED",
          },
        });

        return {
          ...source,
          stats: {
            totalTasks: source._count.tasks,
            completedTasks: completedCount,
            totalItems: source._count.items,
            totalFindings: source._count.findings,
            completionPercentage:
              source._count.tasks > 0 ? Math.round((completedCount / source._count.tasks) * 100) : 0,
          },
        };
      })
    );

    return NextResponse.json(sourcesWithStats);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Sources fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "CREATE");

    const body = await req.json();
    const validatedData = createSourceSchema.parse(body);

    // Verify user has access to selected entities
    const userEntityIds = getUserEntities(session);
    const invalidEntityIds = validatedData.entityIds.filter((id: string) => !userEntityIds.includes(id));
    if (invalidEntityIds.length > 0) {
      return NextResponse.json({ error: "Access denied to selected entities" }, { status: 403 });
    }

    // Create source
    const source = await prisma.source.create({
      data: {
        code: validatedData.code,
        name: validatedData.name,
        sourceType: validatedData.sourceType,
        issuingAuthorityId: validatedData.issuingAuthorityId || null,
        effectiveDate: validatedData.effectiveDate ? new Date(validatedData.effectiveDate) : null,
        reviewDate: validatedData.reviewDate ? new Date(validatedData.reviewDate) : null,
        teamId: validatedData.teamId,
        status: "DRAFT",
        entities: {
          create: validatedData.entityIds.map((entityId) => ({
            entityId,
          })),
        },
      },
      include: {
        team: true,
        issuingAuthority: true,
        entities: {
          include: {
            entity: true,
          },
        },
      },
    });

    await logAuditEvent({
      action: "SOURCE_CREATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "Source",
      targetId: source.id,
      details: {
        sourceCode: source.code,
        sourceName: source.name,
        sourceType: source.sourceType,
        entityIds: validatedData.entityIds,
      },
    });

    return NextResponse.json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
      return NextResponse.json({ error: "Invalid input: " + error.issues[0].message }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A source with this code already exists for this team" }, { status: 409 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source creation error:", error);
    return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
  }
}
