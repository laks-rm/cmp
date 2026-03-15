import { z } from "zod";

const NO_HTML_TAGS_REGEX = /<[^>]*>/;
const SAFE_FILE_NAME_REGEX = /^[a-zA-Z0-9 ._()&+,;!@#%^-]+$/;

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

export function sanitizeFileName(fileName: string): string {
  // Keep the original extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  
  // Replace unsafe characters but allow spaces, parens, common chars
  const sanitized = name.replace(/[^a-zA-Z0-9 ._()-]/g, '_');
  
  return sanitized + ext;
}

export function validateUploadMeta(params: { fileName: string; mimeType: string; fileSize: number }): { valid: boolean; error?: string } {
  const allowedMimeTypes = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  if (!allowedMimeTypes.has(params.mimeType)) {
    return { 
      valid: false, 
      error: "File type not supported. Allowed types: PDF, PNG, JPEG, WEBP, TXT, XLSX, DOCX." 
    };
  }
  
  if (params.fileSize <= 0 || params.fileSize > 10 * 1024 * 1024) {
    return { 
      valid: false, 
      error: `File size exceeds the maximum limit of 10 MB.` 
    };
  }
  
  if (!SAFE_FILE_NAME_REGEX.test(params.fileName) || params.fileName.includes("..") || params.fileName.startsWith("/")) {
    return { 
      valid: false, 
      error: "Invalid filename. Please rename the file to remove special characters and try again." 
    };
  }
  
  return { valid: true };
}
