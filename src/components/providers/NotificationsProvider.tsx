"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { toast } from "sonner";

import { invalidateQueriesForNotification } from "@/lib/notification-invalidation";
import {
  NOTIFICATION_POLL_INTERVAL_MS,
  nextBackoffDelay,
  shouldFallbackToPolling,
} from "@/lib/notification-reconnect";
import type {
  NotificationRecord,
  NotificationStreamEvent,
} from "@/lib/workspace-types";
import { NotificationsService } from "@/services/notifications";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "@/stores/notification-store";

class SseDisabledError extends Error {
  constructor() {
    super("SSE_DISABLED");
    this.name = "SseDisabledError";
  }
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API ?? "").replace(/\/+$/, "");
}

function parseData<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Owns the authenticated notification stream.
 *
 * - Seeds the store from `GET /notifications`.
 * - Streams with `@microsoft/fetch-event-source` (headers work, unlike
 *   `EventSource`).
 * - Reconnects with 1s/2s/4s... backing off at 30s.
 * - Falls back to 60s unread-count polling when SSE is disabled or the
 *   connection repeatedly fails.
 */
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      useNotificationStore.getState().reset();
      return;
    }

    let disposed = false;
    let attempt = 0;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();

    void (async () => {
      try {
        const result = await NotificationsService.list({ limit: 20 });
        if (disposed) return;
        useNotificationStore
          .getState()
          .setNotifications(result.notifications, result.unreadCount);
      } catch {
        // The stream (or the polling fallback) will reconcile the badge.
      }
    })();

    const startPolling = () => {
      if (disposed || pollTimer) return;
      useNotificationStore.getState().setStatus("polling");

      const poll = async () => {
        try {
          const result = await NotificationsService.unreadCount();
          if (!disposed) {
            useNotificationStore
              .getState()
              .setUnreadCount(result.unreadCount);
          }
        } catch {
          // A transient failure keeps the previous count and retries.
        }
      };

      void poll();
      pollTimer = setInterval(() => void poll(), NOTIFICATION_POLL_INTERVAL_MS);
    };

    const handleEvent = (event: string | undefined, raw: string, id?: string) => {
      if (event === "ready") {
        const data = parseData<Extract<NotificationStreamEvent, { event: "ready" }>["data"]>(raw);
        if (data && typeof data.unreadCount === "number") {
          useNotificationStore.getState().setUnreadCount(data.unreadCount);
        }
        useNotificationStore.getState().setStatus("live");
        return;
      }

      if (event === "notification") {
        const data = parseData<NotificationRecord>(raw);
        if (!data?.id) return;

        if (id) useNotificationStore.getState().setLastEventId(id);
        const added = useNotificationStore.getState().prepend(data);
        if (added) {
          toast(data.title, { description: data.message });
          invalidateQueriesForNotification(queryClient, data.type);
        }
        return;
      }

      if (event === "session") {
        const data = parseData<{ action?: string }>(raw);
        if (data?.action === "REVOKED_ELSEWHERE") {
          toast("Session ended", {
            description: "Your session was signed out on another device.",
          });
          useNotificationStore.getState().reset();
          void useAuthStore.getState().logout();
        }
        return;
      }

      if (event === "leave") {
        invalidateQueriesForNotification(queryClient, "LEAVE_PROGRESS");
      }
    };

    const connect = async () => {
      if (disposed) return;
      useNotificationStore.getState().setStatus("connecting");
      const lastEventId = useNotificationStore.getState().lastEventId;

      try {
        await fetchEventSource(`${apiBase()}/notifications/stream`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
            ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
          },
          signal: abort.signal,
          openWhenHidden: true,
          async onopen(response) {
            if (
              response.ok &&
              (response.headers.get("content-type") ?? "").includes(
                "text/event-stream",
              )
            ) {
              attempt = 0;
              useNotificationStore.getState().setStatus("live");
              return;
            }

            if (response.status === 503) {
              const body = await response
                .clone()
                .json()
                .catch(() => null);
              if (
                body &&
                typeof body === "object" &&
                (body as { code?: unknown }).code === "SSE_DISABLED"
              ) {
                throw new SseDisabledError();
              }
            }

            throw new Error(`Notification stream failed (${response.status})`);
          },
          onmessage(message) {
            handleEvent(message.event, message.data, message.id);
          },
          onclose() {
            throw new Error("Notification stream closed");
          },
          onerror(error) {
            throw error;
          },
        });
      } catch (error) {
        if (disposed || abort.signal.aborted) return;

        if (error instanceof SseDisabledError) {
          startPolling();
          return;
        }

        attempt += 1;
        if (shouldFallbackToPolling(attempt)) {
          startPolling();
          return;
        }

        useNotificationStore.getState().setStatus("connecting");
        retryTimer = setTimeout(() => void connect(), nextBackoffDelay(attempt));
      }
    };

    void connect();

    return () => {
      disposed = true;
      abort.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      useNotificationStore.getState().setStatus("idle");
    };
  }, [token, queryClient]);

  return <>{children}</>;
}
