import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "./utils/renderers";
import { useNotificationStore } from "@/stores/notification-store";
import type { NotificationRecord } from "@/lib/workspace-types";

const mockFetchEventSource = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockToast = jest.fn();
const mockList = jest.fn();
const mockUnreadCount = jest.fn();

jest.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: (url: string, options: unknown) =>
    mockFetchEventSource(url, options),
}));

jest.mock("sonner", () => {
  const toast = (...args: unknown[]) => mockToast(...args);
  return {
    toast: Object.assign(toast, {
      success: jest.fn(),
      error: jest.fn(),
      message: jest.fn(),
    }),
  };
});

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: Object.assign(
    (selector: (state: { token: string; logout: () => Promise<void> }) => unknown) =>
      selector({ token: "token-1", logout: mockLogout }),
    { getState: () => ({ token: "token-1", logout: mockLogout }) },
  ),
}));

jest.mock("@/services/notifications", () => ({
  NotificationsService: {
    list: (...args: unknown[]) => mockList(...args),
    unreadCount: (...args: unknown[]) => mockUnreadCount(...args),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

import { NotificationsProvider } from "@/components/providers/NotificationsProvider";

interface StreamResponse {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  clone: () => { json: () => Promise<unknown> };
}

interface StreamOptions {
  signal: AbortSignal;
  headers: Record<string, string>;
  onopen: (response: StreamResponse) => Promise<void>;
  onmessage: (message: { event?: string; data: string; id?: string }) => void;
  onclose: () => void;
  onerror: (error: unknown) => void;
}

function streamResponse(
  status = 200,
  contentType = "text/event-stream",
  body: unknown = null,
): StreamResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? contentType : null,
    },
    clone: () => ({ json: async () => body }),
  };
}

function notification(
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

function renderProvider() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NotificationsProvider>
        <div>child</div>
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

/** Capture the options passed to the fake transport without opening a stream. */
function captureStream() {
  let options: StreamOptions | null = null;
  mockFetchEventSource.mockImplementation(
    (_url: string, received: StreamOptions) => {
      options = received;
      // Never settles: the provider is unmounted by the test cleanup.
      return new Promise(() => {});
    },
  );
  return {
    get options(): StreamOptions {
      if (!options) throw new Error("Stream was not opened");
      return options;
    },
    opened: () => options !== null,
  };
}

describe("NotificationsProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationStore.getState().reset();
    mockList.mockResolvedValue({
      success: true,
      notifications: [notification({ id: "seed-1" })],
      unreadCount: 1,
    });
    mockUnreadCount.mockResolvedValue({ success: true, unreadCount: 7 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("seeds the inbox, sends auth headers and applies ready/notification events", async () => {
    const stream = captureStream();
    renderProvider();

    expect(screen.getByText("child")).toBeVisible();
    await waitFor(() =>
      expect(useNotificationStore.getState().notifications).toHaveLength(1),
    );
    expect(mockList).toHaveBeenCalledWith({ limit: 20 });

    await waitFor(() => expect(stream.opened()).toBe(true));
    expect(stream.options.headers.Authorization).toBe("Bearer token-1");
    expect(stream.options.headers.Accept).toBe("text/event-stream");

    await act(async () => {
      await stream.options.onopen(streamResponse());
    });
    expect(useNotificationStore.getState().status).toBe("live");

    await act(async () => {
      stream.options.onmessage({
        event: "ready",
        data: JSON.stringify({
          unreadCount: 4,
          serverTime: "2026-11-13T10:00:00.000Z",
        }),
      });
    });
    expect(useNotificationStore.getState().unreadCount).toBe(4);

    await act(async () => {
      stream.options.onmessage({
        event: "notification",
        id: "evt-42",
        data: JSON.stringify(notification({ id: "streamed-1" })),
      });
    });

    expect(useNotificationStore.getState().lastEventId).toBe("evt-42");
    expect(useNotificationStore.getState().unreadCount).toBe(5);
    expect(useNotificationStore.getState().notifications[0].id).toBe(
      "streamed-1",
    );
    expect(mockToast).toHaveBeenCalledWith(
      "New task",
      expect.objectContaining({ description: "A task was assigned to you." }),
    );
  });

  it("falls back to 60s unread polling when the server reports SSE_DISABLED", async () => {
    jest.useFakeTimers();
    mockFetchEventSource.mockImplementation(
      async (_url: string, options: StreamOptions) => {
        await options.onopen(
          streamResponse(503, "application/json", { code: "SSE_DISABLED" }),
        );
      },
    );

    renderProvider();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(useNotificationStore.getState().status).toBe("polling"),
    );
    expect(mockUnreadCount).toHaveBeenCalledTimes(1);
    expect(useNotificationStore.getState().unreadCount).toBe(7);

    // The polling interval keeps the badge fresh while SSE is unavailable.
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mockUnreadCount).toHaveBeenCalledTimes(2);
  });

  it("backs off 1s, then reconnects with a fresh stream", async () => {
    jest.useFakeTimers();
    let attempts = 0;
    mockFetchEventSource.mockImplementation(
      (_url: string, options: StreamOptions) => {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("network down"));
        // Second attempt stays open.
        return new Promise((resolve) => {
          options.signal.addEventListener("abort", () => resolve(undefined));
        });
      },
    );

    renderProvider();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
    expect(useNotificationStore.getState().status).toBe("connecting");

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(mockFetchEventSource).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    // The second attempt is still open; no third attempt yet.
    expect(mockFetchEventSource).toHaveBeenCalledTimes(2);
  });

  it("clears the session when REVOKED_ELSEWHERE arrives", async () => {
    const stream = captureStream();
    useNotificationStore.getState().setNotifications([notification()], 1);
    renderProvider();

    await waitFor(() => expect(stream.opened()).toBe(true));
    await act(async () => {
      await stream.options.onopen(streamResponse());
      stream.options.onmessage({
        event: "session",
        data: JSON.stringify({ action: "REVOKED_ELSEWHERE" }),
      });
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      "Session ended",
      expect.objectContaining({
        description: "Your session was signed out on another device.",
      }),
    );
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("replays the last event id on reconnect", async () => {
    const stream = captureStream();
    useNotificationStore.getState().setLastEventId("evt-7");
    renderProvider();

    await waitFor(() => expect(stream.opened()).toBe(true));
    expect(stream.options.headers["Last-Event-ID"]).toBe("evt-7");
  });
});
