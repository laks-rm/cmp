import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { validateUploadMeta } from "@/lib/validation";

export interface StorageService {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  download(fileUrl: string): Promise<Buffer>;
  delete(fileUrl: string): Promise<void>;
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
    if (!validateUploadMeta({ fileName: filename, mimeType, fileSize: file.length })) {
      throw new Error("Invalid file upload metadata");
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const extension = path.extname(filename).toLowerCase();
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
}

export class GCSStorageService implements StorageService {
  async upload(): Promise<string> {
    // TODO: Implement with @google-cloud/storage in production.
    throw new Error("GCS storage provider is not implemented yet");
  }
  async download(): Promise<Buffer> {
    // TODO: Implement with @google-cloud/storage in production.
    throw new Error("GCS storage provider is not implemented yet");
  }
  async delete(): Promise<void> {
    // TODO: Implement with @google-cloud/storage in production.
    throw new Error("GCS storage provider is not implemented yet");
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
