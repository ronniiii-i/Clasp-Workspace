import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateQueriesForNotification,
  queryKeysForNotification,
} from "@/lib/notification-invalidation";

function keys(type: string): string[] {
  return queryKeysForNotification(type).map((key) =>
    key.map((part) => String(part)).join(":"),
  );
}

describe("notification query invalidation", () => {
  it("always refreshes notification queries", () => {
    for (const type of [
      "TASK_ASSIGNED",
      "LEAVE_SUBMITTED",
      "LEAVE_PROGRESS",
      "LEAVE_DECIDED",
      "NEW_DEVICE",
      "SYSTEM",
      "UNKNOWN",
    ]) {
      expect(keys(type)).toEqual(
        expect.arrayContaining([
          "notifications",
          "notifications:list",
          "notifications:unread-count",
        ]),
      );
    }
  });

  it("maps task and leave events to workspace data", () => {
    for (const type of [
      "TASK_ASSIGNED",
      "LEAVE_SUBMITTED",
      "LEAVE_PROGRESS",
      "LEAVE_DECIDED",
    ]) {
      expect(keys(type)).toEqual(
        expect.arrayContaining([
          "workspace:records",
          "workspace:aggregate",
          "workspace:module",
        ]),
      );
    }
  });

  it("maps a new device to the session list", () => {
    expect(keys("NEW_DEVICE")).toContain("auth:sessions");
  });

  it("maps system events to ACL and module metadata", () => {
    expect(keys("SYSTEM")).toEqual(
      expect.arrayContaining(["acl", "workspace:module"]),
    );
  });

  it("falls back to the whole workspace for unknown types", () => {
    expect(keys("WHATEVER")).toContain("workspace");
  });

  it("invalidates each mapped key on the query client", () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const client = { invalidateQueries } as unknown as QueryClient;

    invalidateQueriesForNotification(client, "TASK_ASSIGNED");

    expect(invalidateQueries).toHaveBeenCalledTimes(
      queryKeysForNotification("TASK_ASSIGNED").length,
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["workspace", "records"],
    });
  });
});
