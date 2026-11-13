"use client";

import { create } from "zustand";

import type { NotificationRecord } from "@/lib/workspace-types";

/**
 * Notification state shared by the provider (SSE/polling), the bell popover
 * and the history page.
 *
 * The store is the single source of truth for the inbox; React Query is only
 * used for the preferences page and for invalidating unrelated workspace
 * caches after an event arrives.
 */
export type NotificationConnectionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "polling"
  | "error";

export interface NotificationStore {
  notifications: NotificationRecord[];
  unreadCount: number;
  status: NotificationConnectionStatus;
  lastEventId: string | null;

  setNotifications: (
    rows: NotificationRecord[],
    unreadCount?: number,
  ) => void;
  /** Add or replace a notification. Returns true when it was new. */
  prepend: (row: NotificationRecord) => boolean;
  setUnreadCount: (count: number) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setStatus: (status: NotificationConnectionStatus) => void;
  setLastEventId: (id: string | null) => void;
  reset: () => void;
}

const MAX_ROWS = 50;

export function clampUnreadCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function unreadFromRows(rows: NotificationRecord[]): number {
  return rows.filter((row) => !row.read).length;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  status: "idle",
  lastEventId: null,

  setNotifications: (rows, unreadCount) =>
    set({
      notifications: rows.slice(0, MAX_ROWS),
      unreadCount:
        typeof unreadCount === "number"
          ? clampUnreadCount(unreadCount)
          : unreadFromRows(rows),
    }),

  prepend: (row) => {
    if (!row?.id) return false;
    let added = false;

    set((state) => {
      const existing = state.notifications.find((item) => item.id === row.id);
      added = !existing;

      const notifications = [
        row,
        ...state.notifications.filter((item) => item.id !== row.id),
      ].slice(0, MAX_ROWS);

      let unreadCount = clampUnreadCount(state.unreadCount);
      if (!existing && !row.read) {
        unreadCount += 1;
      } else if (existing && existing.read !== row.read) {
        unreadCount += row.read ? -1 : 1;
      }

      return { notifications, unreadCount: clampUnreadCount(unreadCount) };
    });

    return added;
  },

  setUnreadCount: (count) => set({ unreadCount: clampUnreadCount(count) }),

  markRead: (id) =>
    set((state) => {
      const target = state.notifications.find((row) => row.id === id);
      if (!target || target.read) return state;
      return {
        notifications: state.notifications.map((row) =>
          row.id === id
            ? { ...row, read: true, readAt: new Date().toISOString() }
            : row,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((row) =>
        row.read
          ? row
          : { ...row, read: true, readAt: new Date().toISOString() },
      ),
      unreadCount: 0,
    })),

  setStatus: (status) => set({ status }),
  setLastEventId: (lastEventId) => set({ lastEventId }),

  reset: () =>
    set({
      notifications: [],
      unreadCount: 0,
      status: "idle",
      lastEventId: null,
    }),
}));

/** Read the current state outside React (used by the SSE handler). */
export function notificationStore(): NotificationStore {
  return useNotificationStore.getState();
}
