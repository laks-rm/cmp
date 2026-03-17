import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { updateEntitySchema } from "@/lib/validations/entities";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

/**
 * GET /api/admin/entities/[id]
 * Get single entity with full details
 * Requires: ENTITY_MANAGEMENT:VIEW permission
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "ENTITY_MANAGEMENT", "VIEW");

    const entity = await prisma.entity.findUnique({
      where: { id: params.id },
      include: {
        userAccess: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        sourceLinks: {
          select: {
            source: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!entity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    return NextResponse.json(entity);
  } catch (error) {
    console.error("Error fetching entity:", error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/entities/[id]
 * Update entity
 * Requires: ENTITY_MANAGEMENT:EDIT permission
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "ENTITY_MANAGEMENT", "EDIT");

    // Fetch existing entity
    const existingEntity = await prisma.entity.findUnique({
      where: { id: params.id },
    });

    if (!existingEntity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateEntitySchema.parse(body);

    // Check for duplicate code if code is being changed
    if (validatedData.code && validatedData.code !== existingEntity.code) {
      const duplicateEntity = await prisma.entity.findUnique({
        where: { code: validatedData.code },
      });

      if (duplicateEntity) {
        return NextResponse.json(
          { error: "Entity with this code already exists" },
          { status: 409 }
        );
      }
    }

    // Update entity
    const updatedEntity = await prisma.entity.update({
      where: { id: params.id },
      data: validatedData,
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

    // Determine audit action
    const auditAction = validatedData.isActive === false && existingEntity.isActive
      ? "ENTITY_DEACTIVATED"
      : "ENTITY_UPDATED";

    // Audit log
    await logAuditEvent({
      action: auditAction,
      module: "ENTITY_MANAGEMENT",
      userId: session.user.userId,
      entityId: updatedEntity.id,
      targetType: "Entity",
      targetId: updatedEntity.id,
      details: {
        code: updatedEntity.code,
        name: updatedEntity.name,
      },
      oldValues: existingEntity,
      newValues: updatedEntity,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json(updatedEntity);
  } catch (error) {
    console.error("Error updating entity:", error);

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
 * DELETE /api/admin/entities/[id]
 * Soft delete entity (set isActive = false)
 * Requires: ENTITY_MANAGEMENT:DELETE permission
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "ENTITY_MANAGEMENT", "DELETE");

    // Fetch existing entity
    const existingEntity = await prisma.entity.findUnique({
      where: { id: params.id },
    });

    if (!existingEntity) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Soft delete by setting isActive = false
    const updatedEntity = await prisma.entity.update({
      where: { id: params.id },
      data: { isActive: false },
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
      action: "ENTITY_DELETED",
      module: "ENTITY_MANAGEMENT",
      userId: session.user.userId,
      entityId: updatedEntity.id,
      targetType: "Entity",
      targetId: updatedEntity.id,
      details: {
        code: updatedEntity.code,
        name: updatedEntity.name,
      },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
    });

    return NextResponse.json(updatedEntity);
  } catch (error) {
    console.error("Error deleting entity:", error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
