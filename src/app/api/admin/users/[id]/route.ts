import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  email: z.string().email().max(255).toLowerCase().trim().optional(),
  password: z.string().min(8).max(255).optional(),
  roleId: z.string().uuid().optional(),
  teamIds: z.array(z.string().uuid()).optional(),
  entityIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().max(100).optional(),
});

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "USER_MANAGEMENT", "EDIT");

    const userId = context.params.id;
    const body = await req.json();
    const validatedData = updateUserSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.email) {
      // Check if email is already in use by another user
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });
      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
      updateData.email = validatedData.email;
    }
    if (validatedData.password) {
      updateData.passwordHash = await bcrypt.hash(validatedData.password, 12);
    }
    if (validatedData.roleId) updateData.roleId = validatedData.roleId;
    if (validatedData.timezone) updateData.timezone = validatedData.timezone;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    // Update user in a transaction with team memberships and entity access
    const updatedUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update team memberships if provided
      if (validatedData.teamIds) {
        await tx.teamMembership.deleteMany({
          where: { userId },
        });
        await tx.teamMembership.createMany({
          data: validatedData.teamIds.map((teamId) => ({
            userId,
            teamId,
          })),
        });
      }

      // Update entity access if provided
      if (validatedData.entityIds) {
        await tx.userEntityAccess.deleteMany({
          where: { userId },
        });
        await tx.userEntityAccess.createMany({
          data: validatedData.entityIds.map((entityId) => ({
            userId,
            entityId,
          })),
        });
      }

      // Update user
      return await tx.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          role: true,
          teamMemberships: {
            include: {
              team: true,
            },
          },
          entityAccess: {
            include: {
              entity: true,
            },
          },
        },
      });
    });

    await logAuditEvent({
      action: validatedData.isActive === false ? "USER_DEACTIVATED" : "USER_UPDATED",
      module: "USERS",
      userId: session.user.userId,
      targetType: "User",
      targetId: userId,
      details: {
        targetName: updatedUser.name,
        changes: validatedData,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("User update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
