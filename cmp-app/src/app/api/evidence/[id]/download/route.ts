import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StorageServiceFactory } from "@/lib/storage";
import { ApiError } from "@/lib/errors";

const storageService = StorageServiceFactory.getInstance();

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const evidenceId = context.params.id;

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        task: {
          include: {
            entity: true,
          },
        },
        finding: {
          include: {
            entity: true,
          },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    const targetEntity = evidence.task?.entity || evidence.finding?.entity;
    if (targetEntity && !session.user.entityIds.includes(targetEntity.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const isLocal = evidence.fileUrl.startsWith("/api/files/");
    
    if (isLocal) {
      return NextResponse.json({ 
        url: evidence.fileUrl,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType 
      });
    } else {
      const signedUrl = await storageService.getSignedUrl(evidence.fileUrl);
      return NextResponse.json({ 
        url: signedUrl,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType 
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Evidence download URL generation error:", error);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}
