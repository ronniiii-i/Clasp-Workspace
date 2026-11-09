"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import { WorkspaceService } from "@/services/workspace";
import { useWorkspaceRecords } from "./useWorkspaceRecords";
import type {
  LeaveAction,
  LeaveCreateInput,
  LeaveRequestRecord,
  LeaveStatus,
  LeaveTimelineResponse,
  LeaveTransitionInput,
  RecordsPage,
  RecordsQuery,
} from "@/lib/workspace-types";

/**
 * Leave workflow data layer.
 *
 * The generic records endpoint keeps serving the scoped list (the module's
 * data scope filters what the tab can show); every mutation still goes through
 * the state-machine endpoints. Transitions are optimistic over the shared
 * records cache and roll back on failure, including the `409` case where
 * another approver decided first.
 */

const LEAVE_QUERY: RecordsQuery = {
  page: 1,
  pageSize: 100,
  sort: { field: "createdAt", dir: "desc" },
};

const recordsKey = (deptKey: string, moduleKey: string) =>
  ["workspace", "records", deptKey, moduleKey] as const;

const timelineKey = (deptKey: string, moduleKey: string, id: string) =>
  ["workspace", "leave", "timeline", deptKey, moduleKey, id] as const;

interface TransitionVariables {
  id: string;
  input: LeaveTransitionInput;
}

interface TransitionContext {
  snapshots: Array<[readonly unknown[], RecordsPage | undefined]>;
}

/** Next status the server will apply for a legal transition. */
export function nextLeaveStatus(
  current: LeaveStatus | string,
  action: LeaveAction,
): LeaveStatus | string {
  if (action === "CANCEL") return "CANCELLED";
  if (action === "REJECT") return "REJECTED";
  if (current === "PENDING_TEAM_LEAD") return "PENDING_HR";
  if (current === "PENDING_HR") return "APPROVED";
  return current;
}

function optimisticPatch(
  row: LeaveRequestRecord,
  input: LeaveTransitionInput,
): Partial<LeaveRequestRecord> {
  const status = nextLeaveStatus(row.status, input.action);
  const now = new Date().toISOString();
  const patch: Partial<LeaveRequestRecord> = { status: status as LeaveStatus };

  if (status === "PENDING_HR") {
    patch.currentStage = 2;
    if (input.note) patch.decisionNote = input.note;
  } else if (status !== row.status) {
    patch.decidedAt = now;
    patch.decisionNote = input.note ?? null;
    if (status === "CANCELLED") patch.cancelledAt = now;
  }

  return patch;
}

/** Human message that surfaces the `409` conflict clearly. */
export function leaveErrorMessage(error: unknown): string {
  if (ApiError.is(error)) {
    if (error.status === 409) {
      return (
        error.message ||
        "This request changed while you were deciding. Reload and try again."
      );
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function useLeaveWorkflow(deptKey: string, moduleKey: string) {
  const queryClient = useQueryClient();
  const records = useWorkspaceRecords(deptKey, moduleKey, LEAVE_QUERY);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: recordsKey(deptKey, moduleKey),
    });
    void queryClient.invalidateQueries({
      queryKey: ["workspace", "leave", "timeline", deptKey, moduleKey],
    });
    void queryClient.invalidateQueries({
      queryKey: ["workspace", "aggregate"],
    });
  };

  const create = useMutation({
    mutationFn: (input: LeaveCreateInput) =>
      WorkspaceService.createLeaveRequest(deptKey, moduleKey, input),
    onSuccess: invalidate,
  });

  const transition = useMutation({
    mutationFn: ({ id, input }: TransitionVariables) =>
      WorkspaceService.transitionLeaveRequest(deptKey, moduleKey, id, input),
    onMutate: async ({
      id,
      input,
    }: TransitionVariables): Promise<TransitionContext> => {
      await queryClient.cancelQueries({
        queryKey: recordsKey(deptKey, moduleKey),
      });

      const snapshots = queryClient.getQueriesData<RecordsPage>({
        queryKey: recordsKey(deptKey, moduleKey),
      });

      queryClient.setQueriesData<RecordsPage>(
        { queryKey: recordsKey(deptKey, moduleKey) },
        (page) => {
          if (!page) return page;
          return {
            ...page,
            data: page.data.map((row) =>
              row.id === id
                ? {
                    ...row,
                    ...optimisticPatch(row as LeaveRequestRecord, input),
                  }
                : row,
            ),
          };
        },
      );

      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, page] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, page);
      }
    },
    onSettled: invalidate,
  });

  return {
    records,
    create,
    transition,
    invalidate,
    rows: (records.data?.data ?? []) as LeaveRequestRecord[],
  };
}

/** Audit timeline for one request; fetched only while the detail modal is open. */
export function useLeaveTimeline(
  deptKey: string,
  moduleKey: string,
  id: string | null,
) {
  return useQuery<LeaveTimelineResponse>({
    queryKey: timelineKey(deptKey, moduleKey, id ?? ""),
    queryFn: () =>
      WorkspaceService.getLeaveTimeline(deptKey, moduleKey, id as string),
    enabled: Boolean(deptKey && moduleKey && id),
    staleTime: 15 * 1000,
  });
}
