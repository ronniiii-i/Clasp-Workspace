"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { WorkspaceService } from "@/services/workspace";
import type { RecordsPage } from "@/lib/workspace-types";

export interface RecordActionTarget {
  id: string;
  title?: string;
  assigneeId?: string | null;
}

export interface ReassignTarget {
  id: string;
  title: string;
  assigneeId?: string | null;
}

interface UseRecordActionsOptions {
  deptKey: string;
  moduleKey: string;
  /** Human label used in toasts and error copy. */
  moduleName: string;
  /** Canonical terminal status for "complete" (tasks `Completed`, tickets `RESOLVED`). */
  completeStatus?: string;
  statusField?: string;
}

const recordsKey = (deptKey: string, moduleKey: string) =>
  ["workspace", "records", deptKey, moduleKey] as const;

/**
 * Dashboard/record quick actions shared by task and ticket cards.
 *
 * `complete` patches every cached page of the module optimistically, calls the
 * transition endpoint and rolls back on failure. `reassign` exposes a target
 * for the shared reassignment dialog; the dialog itself performs the write.
 */
export function useRecordActions({
  deptKey,
  moduleKey,
  moduleName,
  completeStatus = "Completed",
  statusField = "status",
}: UseRecordActionsOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] =
    useState<ReassignTarget | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: recordsKey(deptKey, moduleKey),
    });
    void queryClient.invalidateQueries({ queryKey: ["workspace", "aggregate"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [deptKey, moduleKey, queryClient]);

  const complete = useCallback(
    async (target: RecordActionTarget): Promise<boolean> => {
      if (!deptKey || !moduleKey) {
        setError("This record is not linked to a module.");
        return false;
      }

      setBusyId(target.id);
      setError(null);

      await queryClient.cancelQueries({
        queryKey: recordsKey(deptKey, moduleKey),
      });
      const snapshots = queryClient.getQueriesData<RecordsPage>({
        queryKey: recordsKey(deptKey, moduleKey),
      });
      for (const [key, page] of snapshots) {
        if (!page) continue;
        queryClient.setQueryData<RecordsPage>(key, {
          ...page,
          data: page.data.map((row) =>
            row.id === target.id ? { ...row, [statusField]: completeStatus } : row,
          ),
        });
      }

      try {
        await WorkspaceService.transitionRecord(
          deptKey,
          moduleKey,
          target.id,
          completeStatus,
        );
        toast.success(`${moduleName} marked complete`);
        invalidate();
        return true;
      } catch (caught) {
        for (const [key, page] of snapshots) {
          queryClient.setQueryData(key, page);
        }
        const message =
          caught instanceof Error
            ? caught.message
            : `Could not complete this ${moduleName.toLowerCase()}.`;
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [
      completeStatus,
      deptKey,
      invalidate,
      moduleKey,
      moduleName,
      queryClient,
      statusField,
    ],
  );

  const reassign = useCallback((target: ReassignTarget) => {
    setError(null);
    setReassignTarget(target);
  }, []);

  const closeReassign = useCallback(() => setReassignTarget(null), []);

  const handleReassigned = useCallback(() => {
    setReassignTarget(null);
    invalidate();
  }, [invalidate]);

  const openRecord = useCallback(
    (id: string) => {
      if (!deptKey || !moduleKey || !id) return;
      router.push(
        `/dept/${encodeURIComponent(deptKey)}/${encodeURIComponent(
          moduleKey,
        )}?open=${encodeURIComponent(id)}`,
      );
    },
    [deptKey, moduleKey, router],
  );

  return {
    complete,
    reassign,
    openRecord,
    busyId,
    error,
    setError,
    reassignTarget,
    closeReassign,
    handleReassigned,
    invalidate,
  };
}
