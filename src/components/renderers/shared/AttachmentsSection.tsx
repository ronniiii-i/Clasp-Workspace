"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttachments, useAttachmentMutations } from "@/hooks/workspace/useAttachments";
import { formatFileSize, ATTACHMENT_ACCEPT } from "@/services/attachments";
import { useAuthStore } from "@/stores/auth-store";
import { formatTimestamp } from "./record-utils";

function isTenantAdmin(user: ReturnType<typeof useAuthStore.getState>["user"]) {
  const role = user?.role;
  if (!role) return false;
  if (typeof role === "string") return role.toLowerCase() === "tenant_admin";
  return Boolean(role.isTenantAdmin) || role.slug === "tenant_admin";
}

/** Upload, list and remove the attachments on one record. */
export function AttachmentsSection({
  deptKey,
  moduleKey,
  recordId,
  canEdit,
}: {
  deptKey: string;
  moduleKey: string;
  recordId: string;
  canEdit: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const attachments = useAttachments(deptKey, moduleKey, recordId);
  const { upload, remove } = useAttachmentMutations(
    deptKey,
    moduleKey,
    recordId,
  );

  const admin = isTenantAdmin(user);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success("Attachment added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload the file",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (id: string, fileName: string) => {
    setBusyId(id);
    try {
      await remove.mutateAsync(id);
      toast.success(`${fileName} removed`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove the file",
      );
    } finally {
      setBusyId(null);
    }
  };

  const rows = attachments.data ?? [];

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          Attachments
        </h3>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              onChange={(event) => void handleFiles(event.target.files)}
              data-testid="attachment-file-input"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3.5 w-3.5" />
              )}
              Upload
            </Button>
          </>
        ) : null}
      </div>

      {attachments.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading attachments…
        </p>
      ) : attachments.isError ? (
        <p className="text-sm text-destructive">
          Attachments could not be loaded.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {rows.map((attachment) => {
            const canDelete =
              canEdit &&
              (attachment.uploadedById === user?.id || admin);
            return (
              <li
                key={attachment.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
                data-testid="attachment-row"
              >
                <div className="min-w-0">
                  <a
                    href={attachment.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 truncate text-sm font-medium text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {attachment.fileName}
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                    {attachment.uploader?.name
                      ? ` · ${attachment.uploader.name}`
                      : ""}
                    {attachment.createdAt
                      ? ` · ${formatTimestamp(attachment.createdAt)}`
                      : ""}
                  </p>
                </div>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${attachment.fileName}`}
                    onClick={() =>
                      void handleRemove(attachment.id, attachment.fileName)
                    }
                    disabled={busyId === attachment.id}
                  >
                    {busyId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
