import path from "path";
import { access, readFile } from "fs/promises";
import { constants } from "fs";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const fileId = context.params.id;
    if (!/^[a-zA-Z0-9._-]+$/.test(fileId) || fileId.includes("..")) {
      return NextResponse.json({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, { status: 404 });
    }

    const fullPath = path.resolve(process.cwd(), "uploads", fileId);
    await access(fullPath, constants.R_OK);
    const fileBuffer = await readFile(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileId}"`,
      },
    });
  } catch (error) {
    console.error("File download failed", error);
    return NextResponse.json({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, { status: 404 });
  }
}
