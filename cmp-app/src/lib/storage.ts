import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { validateUploadMeta, sanitizeFileName } from "@/lib/validation";
import { Storage } from "@google-cloud/storage";

export interface StorageService {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  download(fileUrl: string): Promise<Buffer>;
  delete(fileUrl: string): Promise<void>;
  getSignedUrl(fileUrl: string, expiresInMinutes?: number): Promise<string>;
}

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function ensureFileId(fileUrl: string): string {
  const id = fileUrl.split("/").pop() ?? "";
  if (!id || id.includes("..") || id.includes("/") || id.startsWith(".")) {
    throw new Error("Invalid file id");
  }
  return id;
}

export class LocalStorageService implements StorageService {
  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const validation = validateUploadMeta({ fileName: filename, mimeType, fileSize: file.length });
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid file upload metadata");
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const sanitized = sanitizeFileName(filename);
    const extension = path.extname(sanitized).toLowerCase();
    const id = `${randomUUID()}${extension}`;
    const fullPath = path.join(UPLOADS_DIR, id);
    await writeFile(fullPath, file, { flag: "wx" });
    return `/api/files/${id}`;
  }

  async download(fileUrl: string): Promise<Buffer> {
    const fileId = ensureFileId(fileUrl);
    return readFile(path.join(UPLOADS_DIR, fileId));
  }

  async delete(fileUrl: string): Promise<void> {
    const fileId = ensureFileId(fileUrl);
    await unlink(path.join(UPLOADS_DIR, fileId));
  }

  async getSignedUrl(fileUrl: string): Promise<string> {
    // For local storage, just return the original URL
    return fileUrl;
  }
}

export class GCSStorageService implements StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const projectId = process.env.GCP_PROJECT_ID;
    const bucketName = process.env.GCS_BUCKET_NAME;

    if (!projectId || !bucketName) {
      throw new Error("GCS configuration missing: GCP_PROJECT_ID and GCS_BUCKET_NAME are required");
    }

    this.bucketName = bucketName;
    this.storage = new Storage({ projectId });
  }

  private getBucket() {
    return this.storage.bucket(this.bucketName);
  }

  private generateFilePath(filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = randomUUID();
    const sanitized = sanitizeFileName(filename);
    return `evidence/${year}/${month}/${uuid}-${sanitized}`;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const validation = validateUploadMeta({ fileName: filename, mimeType, fileSize: file.length });
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid file upload metadata");
    }

    const filePath = this.generateFilePath(filename);
    const bucket = this.getBucket();
    const fileRef = bucket.file(filePath);

    try {
      await fileRef.save(file, {
        contentType: mimeType,
        metadata: {
          originalName: filename,
        },
      });

      return filePath;
    } catch (error) {
      console.error("GCS upload error:", error);
      throw new Error("Failed to upload file to GCS");
    }
  }

  async download(fileUrl: string): Promise<Buffer> {
    const bucket = this.getBucket();
    const fileRef = bucket.file(fileUrl);

    try {
      const [buffer] = await fileRef.download();
      return buffer;
    } catch (error) {
      console.error("GCS download error:", error);
      throw new Error("Failed to download file from GCS");
    }
  }

  async delete(fileUrl: string): Promise<void> {
    const bucket = this.getBucket();
    const fileRef = bucket.file(fileUrl);

    try {
      await fileRef.delete();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        console.warn(`GCS file not found (already deleted?): ${fileUrl}`);
        return;
      }
      console.error("GCS delete error:", error);
      throw new Error("Failed to delete file from GCS");
    }
  }

  async getSignedUrl(fileUrl: string, expiresInMinutes: number = 15): Promise<string> {
    const bucket = this.getBucket();
    const fileRef = bucket.file(fileUrl);

    try {
      const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
      const [signedUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: expiresAt,
      });

      return signedUrl;
    } catch (error) {
      console.error("GCS signed URL error:", error);
      throw new Error("Failed to generate signed URL");
    }
  }
}

export function getStorageService(): StorageService {
  if (process.env.STORAGE_PROVIDER === "gcs") {
    return new GCSStorageService();
  }
  return new LocalStorageService();
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export class StorageServiceFactory {
  static getInstance(): StorageService {
    if (!storageServiceInstance) {
      storageServiceInstance = getStorageService();
    }
    return storageServiceInstance;
  }
}
