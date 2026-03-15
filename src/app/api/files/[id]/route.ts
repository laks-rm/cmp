import path from "path";
import { access, readFile } from "fs/promises";
import { constants } from "fs";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Validates and sanitizes file ID to prevent path traversal attacks
 * 
 * @param fileId - The file identifier from URL
 * @returns Sanitized file ID safe for file system operations
 * @throws Error if fileId contains path traversal attempts
 */
function validateFileId(fileId: string): string {
  // Extract just the filename from any URL path
  const fileName = fileId.split('/').pop() || fileId;
  
  // Strict validation: only allow alphanumeric, hyphens, underscores, and dots
  // Dots are only allowed in the middle (for extensions), not at start
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]+)?$/.test(fileName)) {
    throw new Error("Invalid file identifier");
  }
  
  // Additional checks for common path traversal patterns
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Invalid file identifier");
  }
  
  // Prevent hidden files
  if (fileName.startsWith(".")) {
    throw new Error("Invalid file identifier");
  }
  
  return fileName;
}

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

    // Validate file path for security (prevent path traversal)
    let fileName: string;
    try {
      fileName = validateFileId(evidence.fileUrl);
    } catch (error) {
      console.error("Invalid file identifier:", error);
      return NextResponse.json(
        { error: "Resource not found", code: "RESOURCE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Construct absolute path and verify it's within uploads directory
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const fullPath = path.resolve(uploadsDir, fileName);
    
    // Critical: Ensure resolved path is still within uploads directory
    if (!fullPath.startsWith(uploadsDir + path.sep)) {
      console.error("Path traversal attempt detected:", { fileName, fullPath });
      return NextResponse.json(
        { error: "Resource not found", code: "RESOURCE_NOT_FOUND" },
        { status: 404 }
      );
    }

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
