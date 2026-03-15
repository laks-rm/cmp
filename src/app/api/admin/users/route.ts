import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { generateInitials } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(8).max(255),
  roleId: z.string().uuid(),
  teamIds: z.array(z.string().uuid()),
  entityIds: z.array(z.string().uuid()).min(1, "At least one entity required"),
  timezone: z.string().max(100).default("UTC"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "USER_MANAGEMENT", "VIEW");

    const users = await prisma.user.findMany({
      include: {
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        teamMemberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        entityAccess: {
          include: {
            entity: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Users fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "USER_MANAGEMENT", "CREATE");

    const body = await req.json();
    const validatedData = createUserSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    // Generate initials with robust error handling
    const initials = generateInitials(validatedData.name);

    // Create user with team memberships and entity access
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        passwordHash,
        initials,
        roleId: validatedData.roleId,
        timezone: validatedData.timezone,
        isActive: true,
        teamMemberships: {
          create: validatedData.teamIds.map((teamId) => ({
            teamId,
          })),
        },
        entityAccess: {
          create: validatedData.entityIds.map((entityId) => ({
            entityId,
          })),
        },
      },
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

    await logAuditEvent({
      action: "USER_CREATED",
      module: "USERS",
      userId: session.user.userId,
      targetType: "User",
      targetId: user.id,
      details: {
        targetName: user.name,
        email: user.email,
        role: user.role.displayName,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("User creation error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
