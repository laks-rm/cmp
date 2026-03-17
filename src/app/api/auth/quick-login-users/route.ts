import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Only allow in development/non-production environments
    if (process.env.AUTH_PROVIDER === "okta" || process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        name: true,
        email: true,
        initials: true,
        avatarColor: true,
        role: {
          select: {
            displayName: true,
          },
        },
        teamMemberships: {
          include: {
            team: {
              select: {
                name: true,
              },
            },
          },
        },
        entityAccess: {
          include: {
            entity: {
              select: {
                code: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 6,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Quick login users fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
