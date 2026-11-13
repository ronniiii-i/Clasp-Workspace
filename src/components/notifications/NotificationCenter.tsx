"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Info,
  MonitorSmartphone,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { safeNotificationLink } from "@/lib/notification-links";
import type { NotificationRecord } from "@/lib/workspace-types";
import { NotificationsService } from "@/services/notifications";
import { useNotificationStore } from "@/stores/notification-store";

function iconFor(type: string) {
  switch (type) {
    case "TASK_ASSIGNED":
      return ClipboardList;
    case "LEAVE_SUBMITTED":
    case "LEAVE_PROGRESS":
      return CalendarClock;
    case "LEAVE_DECIDED":
      return CheckCircle2;
    case "NEW_DEVICE":
      return MonitorSmartphone;
    default:
      return Info;
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const status = useNotificationStore((state) => state.status);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectNotification = (notification: NotificationRecord) => {
    setOpen(false);
    if (!notification.read) {
      markRead(notification.id);
      void NotificationsService.markRead(notification.id).catch(() => {
        // The next list/SSE refresh reconciles a failed optimistic update.
      });
    }

    const href = safeNotificationLink(notification.link);
    if (href) router.push(href);
  };

  const handleMarkAll = () => {
    if (unreadCount === 0) return;
    markAllRead();
    void NotificationsService.markAllRead().catch(() => {
      // Keep the optimistic state; the next refresh reconciles.
    });
  };

  const label =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            aria-hidden="true"
          >
            {badge}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Notifications</h2>
              {status === "polling" ? (
                <span
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  title="Live updates are unavailable; the badge refreshes every minute."
                >
                  <WifiOff className="size-3" aria-hidden="true" />
                  Polling
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all read
            </Button>
          </div>

          <ul className="max-h-96 overflow-y-auto" aria-live="polite">
            {notifications.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                You are all caught up.
              </li>
            ) : (
              notifications.map((notification) => {
                const Icon = iconFor(notification.type);
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => selectNotification(notification)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        !notification.read && "bg-accent/40",
                      )}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              notification.read
                                ? "text-foreground"
                                : "font-semibold",
                            )}
                          >
                            {notification.title}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelative(notification.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                          {notification.message}
                        </span>
                      </span>
                      {!notification.read ? (
                        <span
                          className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-border px-4 py-2 text-right">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push("/account/notifications");
              }}
            >
              View all
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
