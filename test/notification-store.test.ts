import {
  clampUnreadCount,
  unreadFromRows,
  useNotificationStore,
} from "@/stores/notification-store";
import type { NotificationRecord } from "@/lib/workspace-types";

function row(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: "notification-1",
    type: "TASK_ASSIGNED",
    title: "New task",
    message: "A task was assigned to you.",
    link: "/dept/operations/project-management?open=task-1",
    metadata: null,
    read: false,
    createdAt: "2026-11-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("notification store", () => {
  beforeEach(() => {
    useNotificationStore.getState().reset();
  });

  it("seeds rows and derives the unread count", () => {
    useNotificationStore
      .getState()
      .setNotifications([row({ id: "a", read: true }), row({ id: "b" })]);

    expect(useNotificationStore.getState().notifications).toHaveLength(2);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("prepends a new unread notification and increments the badge", () => {
    useNotificationStore.getState().setNotifications([row({ id: "a" })], 1);

    const added = useNotificationStore.getState().prepend(row({ id: "b" }));

    expect(added).toBe(true);
    expect(useNotificationStore.getState().notifications[0].id).toBe("b");
    expect(useNotificationStore.getState().unreadCount).toBe(2);
  });

  it("dedupes replays without double-counting or reordering duplicates", () => {
    useNotificationStore.getState().setNotifications([row({ id: "a" })], 1);

    const added = useNotificationStore.getState().prepend(row({ id: "a" }));

    expect(added).toBe(false);
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("adjusts the count when a stored unread row arrives already read", () => {
    useNotificationStore.getState().setNotifications([row({ id: "a" })], 1);

    useNotificationStore.getState().prepend(row({ id: "a", read: true }));

    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it("marks one notification read exactly once", () => {
    useNotificationStore
      .getState()
      .setNotifications([row({ id: "a" }), row({ id: "b" })], 2);

    useNotificationStore.getState().markRead("a");
    useNotificationStore.getState().markRead("a");

    expect(useNotificationStore.getState().unreadCount).toBe(1);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it("marks every row read", () => {
    useNotificationStore
      .getState()
      .setNotifications([row({ id: "a" }), row({ id: "b" })], 2);

    useNotificationStore.getState().markAllRead();

    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(
      useNotificationStore.getState().notifications.every((item) => item.read),
    ).toBe(true);
  });

  it("clamps invalid counts and counts rows defensively", () => {
    expect(clampUnreadCount(-4)).toBe(0);
    expect(clampUnreadCount(Number.NaN)).toBe(0);
    expect(unreadFromRows([row({ id: "a", read: true }), row({ id: "b" })])).toBe(
      1,
    );
  });
});
