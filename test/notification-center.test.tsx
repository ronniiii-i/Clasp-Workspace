import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils/renderers";
import { useNotificationStore } from "@/stores/notification-store";
import type { NotificationRecord } from "@/lib/workspace-types";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock("@/services/notifications", () => ({
  NotificationsService: {
    markRead: jest.fn().mockResolvedValue({ success: true }),
    markAllRead: jest.fn().mockResolvedValue({ success: true, updated: 2 }),
  },
}));

import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { NotificationsService } from "@/services/notifications";

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
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationCenter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationStore.getState().reset();
  });

  it("shows the unread badge and opens a keyboard-accessible inbox", () => {
    useNotificationStore
      .getState()
      .setNotifications([row({ id: "a" }), row({ id: "b" })], 2);

    renderWithProviders(<NotificationCenter />);

    const trigger = screen.getByRole("button", {
      name: "Notifications, 2 unread",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeVisible();
    expect(screen.getAllByText("New task")).toHaveLength(2);
  });

  it("marks all notifications read optimistically and on the server", async () => {
    useNotificationStore.getState().setNotifications([row({ id: "a" })], 1);

    renderWithProviders(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mark all read/ }));

    expect(useNotificationStore.getState().unreadCount).toBe(0);
    await waitFor(() =>
      expect(NotificationsService.markAllRead).toHaveBeenCalledTimes(1),
    );
  });

  it("marks an item read and navigates through a safe relative link", async () => {
    useNotificationStore.getState().setNotifications([row({ id: "a" })], 1);

    renderWithProviders(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(screen.getByText("New task"));

    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(mockPush).toHaveBeenCalledWith(
      "/dept/operations/project-management?open=task-1",
    );
    await waitFor(() =>
      expect(NotificationsService.markRead).toHaveBeenCalledWith("a"),
    );
  });

  it("refuses to navigate through an absolute link", () => {
    useNotificationStore
      .getState()
      .setNotifications(
        [row({ id: "a", link: "https://evil.test/account" })],
        1,
      );

    renderWithProviders(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(screen.getByText("New task"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    renderWithProviders(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("You are all caught up.")).toBeVisible();
  });
});
