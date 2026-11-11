"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceService } from "@/services/workspace";
import { uploadAttachment } from "@/services/attachments";

const attachmentsKey = (
  deptKey: string,
  moduleKey: string,
  recordId: string,
) => ["workspace", "attachments", deptKey, moduleKey, recordId] as const;

/** Attachments for one record, only fetched when the section is visible. */
export function useAttachments(
  deptKey: string,
  moduleKey: string,
  recordId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: attachmentsKey(deptKey, moduleKey, recordId ?? ""),
    queryFn: () =>
      WorkspaceService.listAttachments(
        deptKey,
        moduleKey,
        recordId as string,
      ).then((response) => response.data),
    enabled:
      Boolean(deptKey && moduleKey && recordId) && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

export function useAttachmentMutations(
  deptKey: string,
  moduleKey: string,
  recordId: string,
) {
  const queryClient = useQueryClient();
  const key = attachmentsKey(deptKey, moduleKey, recordId);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadAttachment(deptKey, moduleKey, recordId, file),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      WorkspaceService.deleteAttachment(
        deptKey,
        moduleKey,
        recordId,
        attachmentId,
      ),
    onSuccess: invalidate,
  });

  return { upload, remove };
}
