import { apiRequest } from "./api-client";
import { WorkspaceService } from "./workspace";
import type {
  AttachmentRecord,
  PresignUploadResult,
} from "@/lib/workspace-types";

/** Keep in sync with `STORAGE_MAX_ATTACHMENT_BYTES` on the backend. */
export const ATTACHMENT_MAX_BYTES = 26_214_400;

export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,application/pdf,text/csv," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Upload a file straight to object storage, then register the metadata row.
 *
 * The backend validates the finished object (ownership, content type, size),
 * so the browser never sees the storage credentials.
 */
export async function uploadAttachment(
  deptKey: string,
  moduleKey: string,
  recordId: string,
  file: File,
): Promise<AttachmentRecord> {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error("This file is larger than the 25 MB limit.");
  }

  const presign = await apiRequest<PresignUploadResult>("/storage/presign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "attachment",
      contentType: file.type || "application/octet-stream",
      size: file.size,
      entityType: deptKey,
      entityId: recordId,
    }),
    errorMessage: "Could not start the upload",
  });

  const uploaded = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  });

  if (!uploaded.ok) {
    throw new Error("The file could not be uploaded.");
  }

  return WorkspaceService.registerAttachment(deptKey, moduleKey, recordId, {
    key: presign.key,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
