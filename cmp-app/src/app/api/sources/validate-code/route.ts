import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

// GET /api/sources/validate-code?code=MFSA-AML-2026&teamId=...&excludeId=...
// Returns { isAvailable: boolean, suggestedCode?: string }
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const teamId = searchParams.get("teamId");
    const excludeId = searchParams.get("excludeId"); // For editing existing source

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (!teamId) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    // Check if code exists for this team
    const where: {
      code: string;
      teamId: string;
      id?: { not: string };
    } = {
      code: code.toUpperCase(),
      teamId,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existing = await prisma.source.findFirst({ where });

    if (!existing) {
      return NextResponse.json({ isAvailable: true });
    }

    // Code is taken, suggest an alternative with numeric suffix
    let suggestedCode = code.toUpperCase();
    let suffix = 2;

    while (true) {
      const testCode = `${code.toUpperCase()}-${suffix}`;
      const checkWhere: {
        code: string;
        teamId: string;
        id?: { not: string };
      } = {
        code: testCode,
        teamId,
      };

      if (excludeId) {
        checkWhere.id = { not: excludeId };
      }

      const exists = await prisma.source.findFirst({ where: checkWhere });

      if (!exists) {
        suggestedCode = testCode;
        break;
      }

      suffix++;

      // Safety limit to prevent infinite loop
      if (suffix > 100) {
        suggestedCode = `${code.toUpperCase()}-${Date.now()}`;
        break;
      }
    }

    return NextResponse.json({
      isAvailable: false,
      suggestedCode,
    });
  } catch (error) {
    console.error("GET /api/sources/validate-code error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to validate source code" }, { status: 500 });
  }
}
