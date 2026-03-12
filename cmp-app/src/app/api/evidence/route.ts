import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { uploadEvidenceSchema } from "@/lib/validations/evidence";
import { StorageServiceFactory } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

const storageService = StorageServiceFactory.getInstance();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const findingId = searchParams.get("findingId");

    if (!taskId && !findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
    }

    const evidence = await prisma.evidence.findMany({
      where: {
        ...(taskId && { taskId }),
        ...(findingId && { findingId }),
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(evidence);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Evidence fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch evidence" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASK_EXECUTION", "EDIT");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const taskId = formData.get("taskId") as string | null;
    const findingId = formData.get("findingId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!taskId && !findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
    }

    // Validate file metadata
    const validatedData = uploadEvidenceSchema.parse({
      taskId: taskId || undefined,
      findingId: findingId || undefined,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload file
    const fileUrl = await storageService.upload(buffer, validatedData.fileName, validatedData.mimeType);

    // Create evidence record
    const evidence = await prisma.evidence.create({
      data: {
        taskId: validatedData.taskId,
        findingId: validatedData.findingId,
        fileName: validatedData.fileName,
        fileUrl,
        fileSize: validatedData.fileSize,
        mimeType: validatedData.mimeType,
        uploadedById: session.user.userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
      },
    });

    // Audit log
    await logAuditEvent({
      action: "EVIDENCE_UPLOADED",
      module: "TASKS",
      userId: session.user.userId,
      targetType: taskId ? "Task" : "Finding",
      targetId: taskId || findingId || undefined,
      details: {
        evidenceId: evidence.id,
        fileName: evidence.fileName,
        fileSize: evidence.fileSize,
      },
    });

    return NextResponse.json(evidence);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Evidence upload error:", error);
    return NextResponse.json({ error: "Failed to upload evidence" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASK_EXECUTION", "EDIT");

    const { searchParams } = new URL(req.url);
    const evidenceId = searchParams.get("id");

    if (!evidenceId) {
      return NextResponse.json({ error: "Evidence ID required" }, { status: 400 });
    }

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // Delete file from storage
    await storageService.delete(evidence.fileUrl);

    // Delete evidence record
    await prisma.evidence.delete({
      where: { id: evidenceId },
    });

    // Audit log
    await logAuditEvent({
      action: "EVIDENCE_DELETED",
      module: "TASKS",
      userId: session.user.userId,
      targetType: evidence.taskId ? "Task" : "Finding",
      targetId: evidence.taskId || evidence.findingId || undefined,
      details: {
        evidenceId: evidence.id,
        fileName: evidence.fileName,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Evidence deletion error:", error);
    return NextResponse.json({ error: "Failed to delete evidence" }, { status: 500 });
  }
}
