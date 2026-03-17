import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    // Find all roles that have REVIEW_QUEUE:APPROVE granted
    const reviewerRoles = await prisma.rolePermission.findMany({
      where: {
        granted: true,
        permission: {
          module: "REVIEW_QUEUE",
          action: "APPROVE",
        },
      },
      select: { roleId: true },
    });

    const roleIds = reviewerRoles.map((r: { roleId: string }) => r.roleId);

    // Find all active users with those roles
    const reviewers = await prisma.user.findMany({
      where: {
        roleId: { in: roleIds },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        initials: true,
        avatarColor: true,
        role: { select: { displayName: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(reviewers);
  } catch (error) {
    console.error("GET /api/users/reviewers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
