import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createFindingSchema } from "@/lib/validations/findings";
import { logAuditEvent } from "@/lib/audit";
import { notifyFindingCreated } from "@/lib/notifications";
import { ApiError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "FINDINGS", "VIEW");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const sourceId = searchParams.get("sourceId");
    const actionOwnerId = searchParams.get("actionOwnerId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const critical = searchParams.get("critical") === "true";

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (sourceId) where.sourceId = sourceId;
    if (actionOwnerId) where.actionOwnerId = actionOwnerId;

    // Entity access filter
    if (session.user.entityIds.length > 0) {
      where.entityId = { in: session.user.entityIds };
    }

    // Critical findings filter (top 4 most critical open)
    if (critical) {
      where.status = { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] };
    }

    const orderBy: Record<string, string>[] = critical
      ? [
          { severity: "asc" }, // CRITICAL first
          { targetDate: "asc" }, // Then by due date
        ]
      : [{ createdAt: "desc" }];

    const findings = await prisma.finding.findMany({
      where,
      include: {
        source: true,
        task: true,
        entity: true,
        actionOwner: {
          select: {
            id: true,
            name: true,
            initials: true,
            avatarColor: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            initials: true,
            avatarColor: true,
          },
        },
        _count: {
          select: {
            evidence: true,
            comments: true,
          },
        },
      },
      orderBy,
      take: critical ? 4 : limit,
    });

    return NextResponse.json(findings);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Findings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch findings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "FINDINGS", "CREATE");

    const body = await req.json();
    const validatedData = createFindingSchema.parse(body);

    // Check entity access
    if (!session.user.entityIds.includes(validatedData.entityId)) {
      return NextResponse.json({ error: "Access denied to entity" }, { status: 403 });
    }

    // Generate reference: F-{YEAR}-{SEQ}
    const year = new Date().getFullYear();
    const lastFinding = await prisma.finding.findFirst({
      where: {
        reference: {
          startsWith: `F-${year}-`,
        },
      },
      orderBy: { reference: "desc" },
    });

    let sequence = 1;
    if (lastFinding) {
      const lastSeq = parseInt(lastFinding.reference.split("-")[2]);
      sequence = lastSeq + 1;
    }

    const reference = `F-${year}-${sequence.toString().padStart(3, "0")}`;

    const finding = await prisma.finding.create({
      data: {
        reference,
        title: validatedData.title,
        description: validatedData.description,
        severity: validatedData.severity,
        rootCause: validatedData.rootCause,
        impact: validatedData.impact,
        managementResponse: validatedData.managementResponse,
        targetDate: validatedData.targetDate ? new Date(validatedData.targetDate) : null,
        sourceId: validatedData.sourceId,
        taskId: validatedData.taskId,
        entityId: validatedData.entityId,
        actionOwnerId: validatedData.actionOwnerId,
        raisedById: session.user.userId,
        status: "OPEN",
      },
      include: {
        source: true,
        entity: true,
        actionOwner: true,
        raisedBy: true,
      },
    });

    // Create notification for action owner
    await notifyFindingCreated(finding.id, finding.reference, finding.title, validatedData.actionOwnerId, session.user.name || "System");

    await logAuditEvent({
      action: "FINDING_CREATED",
      module: "FINDINGS",
      userId: session.user.userId,
      entityId: validatedData.entityId,
      targetType: "Finding",
      targetId: finding.id,
      details: {
        reference: finding.reference,
        severity: finding.severity,
        actionOwnerId: validatedData.actionOwnerId,
      },
    });

    return NextResponse.json(finding);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Finding creation error:", error);
    return NextResponse.json({ error: "Failed to create finding" }, { status: 500 });
  }
}
