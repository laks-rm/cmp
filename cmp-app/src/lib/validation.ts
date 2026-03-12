import { z } from "zod";

const NO_HTML_TAGS_REGEX = /<[^>]*>/;
const SAFE_FILE_NAME_REGEX = /^[a-zA-Z0-9._-]+$/;

function withoutHtml(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((value) => !NO_HTML_TAGS_REGEX.test(value), "Invalid text content");
}

export const secureSchemas = {
  id: z.string().uuid(),
  email: z.string().trim().email().max(255),
  name: withoutHtml(255),
  description: withoutHtml(5000).optional(),
  comment: withoutHtml(2000),
};

export function validateUploadMeta(params: { fileName: string; mimeType: string; fileSize: number }): boolean {
  const allowedMimeTypes = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);

  if (!allowedMimeTypes.has(params.mimeType)) {
    return false;
  }
  if (params.fileSize <= 0 || params.fileSize > 10 * 1024 * 1024) {
    return false;
  }
  if (!SAFE_FILE_NAME_REGEX.test(params.fileName) || params.fileName.includes("..") || params.fileName.startsWith("/")) {
    return false;
  }
  return true;
}
