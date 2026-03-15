import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";

/**
 * Health check endpoint for database backup monitoring
 * 
 * Checks:
 * - Last backup timestamp
 * - Backup file size
 * - Time since last backup
 * - Backup location availability
 * 
 * Returns:
 * - status: "healthy" | "warning" | "error"
 * - lastBackup: ISO timestamp
 * - hoursSinceBackup: number
 * - backupSize: string (human-readable)
 * - location: string
 */
export async function GET(req: NextRequest) {
  try {
    const bucketName = process.env.GCS_BUCKET;
    
    if (!bucketName) {
      return NextResponse.json(
        {
          status: "error",
          error: "GCS_BUCKET not configured",
          message: "Cloud backup monitoring unavailable",
        },
        { status: 500 }
      );
    }

    // Initialize GCS client
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    
    // List files in daily backup directory
    const [files] = await bucket.getFiles({
      prefix: "daily/",
      maxResults: 1,
      orderBy: "timeCreated desc",
    });

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          error: "No backups found",
          message: "No backup files found in cloud storage",
          location: `gs://${bucketName}/daily/`,
        },
        { status: 404 }
      );
    }

    const latestBackup = files[0];
    const metadata = latestBackup.metadata;
    
    const backupTimestamp = new Date(metadata.timeCreated!);
    const now = new Date();
    const hoursSinceBackup = (now.getTime() - backupTimestamp.getTime()) / 3600000;
    
    // Determine health status
    let status: "healthy" | "warning" | "error" = "healthy";
    let message = "Backup system is healthy";
    
    if (hoursSinceBackup > 24) {
      status = "error";
      message = "No successful backup in last 24 hours";
    } else if (hoursSinceBackup > 12) {
      status = "warning";
      message = "Backup is overdue (>12 hours since last backup)";
    }
    
    // Format backup size
    const backupSizeBytes = parseInt(metadata.size || "0");
    const backupSize = formatBytes(backupSizeBytes);
    
    // Check if backup size is suspiciously small (< 1MB)
    if (backupSizeBytes < 1024 * 1024) {
      status = "warning";
      message = "Backup file is suspiciously small";
    }

    return NextResponse.json({
      status,
      message,
      lastBackup: backupTimestamp.toISOString(),
      hoursSinceBackup: parseFloat(hoursSinceBackup.toFixed(2)),
      backupSize,
      backupSizeBytes,
      fileName: latestBackup.name,
      location: `gs://${bucketName}/${latestBackup.name}`,
      metadata: {
        created: metadata.timeCreated,
        updated: metadata.updated,
        contentType: metadata.contentType,
        generation: metadata.generation,
      },
    });
  } catch (error) {
    console.error("Backup health check failed:", error);
    
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
