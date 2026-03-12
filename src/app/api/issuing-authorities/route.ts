import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { z } from "zod";

const createAuthoritySchema = z.object({
  name: z.string().min(1).max(255).trim(),
  abbreviation: z.string().max(50).trim().optional().nullable(),
  country: z.string().max(100).trim().optional().nullable(),
});

// GET /api/issuing-authorities - List all active issuing authorities
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorities = await prisma.issuingAuthority.findMany({
      where: { isActive: true },
      orderBy: [
        { country: "asc" },
        { name: "asc" }
      ],
      select: {
        id: true,
        name: true,
        abbreviation: true,
        country: true,
      },
    });

    return NextResponse.json({ authorities });
  } catch (error) {
    console.error("GET /api/issuing-authorities error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch issuing authorities" }, { status: 500 });
  }
}

// POST /api/issuing-authorities - Create a new issuing authority (Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has ENTITY_CONFIG.ADMIN_CONFIG permission (we'll use this for authorities management)
    const canAdmin = await hasPermission(session, "ENTITY_CONFIG", "ADMIN_CONFIG");
    if (!canAdmin) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const validated = createAuthoritySchema.parse(body);

    // Check for duplicate name
    const existing = await prisma.issuingAuthority.findUnique({
      where: { name: validated.name },
    });

    if (existing) {
      return NextResponse.json({ error: "An authority with this name already exists" }, { status: 400 });
    }

    const authority = await prisma.issuingAuthority.create({
      data: {
        name: validated.name,
        abbreviation: validated.abbreviation || null,
        country: validated.country || null,
      },
    });

    await logAuditEvent({
      action: "AUTHORITY_CREATED",
      module: "ENTITY_CONFIG",
      userId: session.user.userId,
      targetType: "IssuingAuthority",
      targetId: authority.id,
      details: { name: authority.name, abbreviation: authority.abbreviation },
    });

    return NextResponse.json({ authority }, { status: 201 });
  } catch (error) {
    console.error("POST /api/issuing-authorities error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create issuing authority" }, { status: 500 });
  }
}
