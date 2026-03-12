import path from "path";
import { access, readFile } from "fs/promises";
import { constants } from "fs";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const evidenceId = context.params.id;
    
    // Fetch evidence record from database
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
      return NextResponse.json({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, { status: 404 });
    }

    // Check entity access
    const targetEntity = evidence.task?.entity || evidence.finding?.entity;
    if (targetEntity && !session.user.entityIds.includes(targetEntity.id)) {
      return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
    }

    // Validate file path for security
    const fileName = evidence.fileUrl.split('/').pop() || evidence.fileUrl;
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.includes("..")) {
      return NextResponse.json({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, { status: 404 });
    }

    const fullPath = path.resolve(process.cwd(), "uploads", fileName);
    await access(fullPath, constants.R_OK);
    const fileBuffer = await readFile(fullPath);

    // Determine if file should be opened inline (PDF, images) or downloaded
    const viewableTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    const isViewable = viewableTypes.includes(evidence.mimeType);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": evidence.mimeType || "application/octet-stream",
        "Content-Disposition": `${isViewable ? "inline" : "attachment"}; filename="${evidence.fileName}"`,
        "Content-Length": evidence.fileSize.toString(),
      },
    });
  } catch (error) {
    console.error("File download failed", error);
    return NextResponse.json({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, { status: 404 });
  }
}
