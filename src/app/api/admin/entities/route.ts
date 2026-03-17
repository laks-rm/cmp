import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { createEntitySchema, queryEntitySchema } from "@/lib/validations/entities";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

/**
 * GET /api/admin/entities
 * List all entities (admin view with counts and inactive entities)
 * Requires: ENTITY_MANAGEMENT:VIEW permission
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "ENTITY_MANAGEMENT", "VIEW");

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const validatedQuery = queryEntitySchema.parse({
      isActive: searchParams.get("isActive") || undefined,
      search: searchParams.get("search") || undefined,
    });

    // Build where clause
    const where: Prisma.EntityWhereInput = {};

    if (validatedQuery.isActive) {
      where.isActive = validatedQuery.isActive === "true";
    }

    if (validatedQuery.search) {
      where.OR = [
        { code: { contains: validatedQuery.search, mode: "insensitive" } },
        { name: { contains: validatedQuery.search, mode: "insensitive" } },
        { shortName: { contains: validatedQuery.search, mode: "insensitive" } },
      ];
    }

    // Fetch entities with counts
    const entities = await prisma.entity.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        jurisdiction: true,
        regulator: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            userAccess: true,
            sourceLinks: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(entities);
  } catch (error) {
    console.error("Error fetching entities:", error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/entities
 * Create new entity
 * Requires: ENTITY_MANAGEMENT:CREATE permission
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "ENTITY_MANAGEMENT", "CREATE");

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createEntitySchema.parse(body);

    // Check for duplicate code
    const existingEntity = await prisma.entity.findUnique({
      where: { code: validatedData.code },
    });

    if (existingEntity) {
      return NextResponse.json(
        { error: "Entity with this code already exists" },
        { status: 409 }
      );
    }

    // Create entity
    const entity = await prisma.entity.create({
      data: {
        ...validatedData,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        shortName: true,
        jurisdiction: true,
        regulator: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await logAuditEvent({
      action: "ENTITY_CREATED",
      module: "ENTITY_MANAGEMENT",
      userId: session.user.userId,
      entityId: entity.id,
      targetType: "Entity",
      targetId: entity.id,
      details: {
        code: entity.code,
        name: entity.name,
      },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    console.error("Error creating entity:", error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
