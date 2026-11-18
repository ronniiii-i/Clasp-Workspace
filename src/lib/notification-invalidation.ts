import type { QueryClient } from "@tanstack/react-query";

/**
 * Map a notification type to the React Query keys that must be refreshed.
 *
 * Backend metadata is intentionally thin (task ids, leave ids, device labels),
 * so invalidation is broad and type-based. Notification keys are always
 * refreshed; the workspace keys below keep an already-open list, board or
 * dashboard from showing stale data after an event.
 */
export function queryKeysForNotification(type: string): unknown[][] {
  const keys: unknown[][] = [["notifications"], ["notifications", "list"], ["notifications", "unread-count"]];

  switch (type) {
    case "TASK_ASSIGNED":
      return [
        ...keys,
        ["workspace", "records"],
        ["workspace", "aggregate"],
        ["workspace", "module"],
      ];
    case "LEAVE_SUBMITTED":
    case "LEAVE_PROGRESS":
    case "LEAVE_DECIDED":
      return [
        ...keys,
        ["workspace", "records"],
        ["workspace", "aggregate"],
        ["workspace", "module"],
      ];
    case "NEW_DEVICE":
      return [...keys, ["auth", "sessions"]];
    case "SYSTEM":
      return [
        ...keys,
        ["acl"],
        ["workspace", "module"],
        ["workspace", "aggregate"],
      ];
    default:
      return [...keys, ["workspace"]];
  }
}

/** Invalidate every query that a notification type can affect. */
export function invalidateQueriesForNotification(
  queryClient: QueryClient,
  type: string,
): void {
  for (const queryKey of queryKeysForNotification(type)) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
