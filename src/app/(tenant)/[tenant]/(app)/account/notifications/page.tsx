"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatRelative } from "@/lib/format";
import { safeNotificationLink } from "@/lib/notification-links";
import type {
  NotificationPreference,
  NotificationRecord,
  NotificationType,
} from "@/lib/workspace-types";
import { NotificationsService } from "@/services/notifications";
import { useNotificationStore } from "@/stores/notification-store";

const TYPE_COPY: Record<
  NotificationType,
  { label: string; description: string }
> = {
  TASK_ASSIGNED: {
    label: "Task assignments",
    description: "When a task is assigned or reassigned to you.",
  },
  LEAVE_SUBMITTED: {
    label: "Leave awaiting approval",
    description: "When a leave request reaches your stage.",
  },
  LEAVE_PROGRESS: {
    label: "Leave progress",
    description: "When a request you are involved with advances a stage.",
  },
  LEAVE_DECIDED: {
    label: "Leave decisions",
    description: "When your leave request is approved, rejected or cancelled.",
  },
  NEW_DEVICE: {
    label: "New device sign-in",
    description: "When your account signs in on a new device.",
  },
  SYSTEM: {
    label: "Workspace updates",
    description: "Invitations and module provisioning notices.",
  },
};

const TYPE_ORDER: NotificationType[] = [
  "TASK_ASSIGNED",
  "LEAVE_SUBMITTED",
  "LEAVE_PROGRESS",
  "LEAVE_DECIDED",
  "NEW_DEVICE",
  "SYSTEM",
];

export default function AccountNotificationsPage() {
  const queryClient = useQueryClient();
  const markReadStore = useNotificationStore((state) => state.markRead);
  const markAllReadStore = useNotificationStore((state) => state.markAllRead);

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [draft, setDraft] = useState<NotificationPreference[] | null>(null);
  const [saving, setSaving] = useState(false);

  const preferencesQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => NotificationsService.getPreferences(),
    staleTime: 5 * 60 * 1000,
  });

  const historyQuery = useQuery({
    queryKey: ["notifications", "list", { unread: filter === "unread" }],
    queryFn: () =>
      NotificationsService.list({
        unread: filter === "unread",
        limit: 50,
      }),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      setDraft(preferencesQuery.data.preferences);
    }
  }, [preferencesQuery.data]);

  const preferences = useMemo(() => {
    const rows = draft ?? preferencesQuery.data?.preferences ?? [];
    return [...rows].sort(
      (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
    );
  }, [draft, preferencesQuery.data]);

  const notifications = historyQuery.data?.notifications ?? [];

  const toggle = (
    type: NotificationType,
    field: "inApp" | "email",
    checked: boolean,
  ) => {
    setDraft((current) =>
      (current ?? preferencesQuery.data?.preferences ?? []).map((row) =>
        row.type === type ? { ...row, [field]: checked } : row,
      ),
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await NotificationsService.updatePreferences({
        preferences: draft.map((row) => ({
          type: row.type,
          inApp: row.inApp,
          email: row.email,
        })),
      });
      setDraft(result.preferences);
      await queryClient.invalidateQueries({
        queryKey: ["notifications", "preferences"],
      });
      toast.success("Notification preferences saved.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not save notification preferences.",
      );
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (notification: NotificationRecord) => {
    if (notification.read) return;
    markReadStore(notification.id);
    try {
      await NotificationsService.markRead(notification.id);
    } catch {
      // Reconcile below regardless.
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  const markAllRead = async () => {
    markAllReadStore();
    try {
      await NotificationsService.markAllRead();
    } catch {
      // Reconcile below regardless.
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  const preferencesError = preferencesQuery.isError
    ? (preferencesQuery.error as Error).message
    : null;
  const historyError = historyQuery.isError
    ? (historyQuery.error as Error).message
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Notifications
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your inbox and choose which updates reach you in-app or by
            email.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/account/security">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Account security
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery preferences</CardTitle>
          <CardDescription>
            In-app notifications always appear in the bell unless you turn them
            off here. Email is opt-in per type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preferencesQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-14 w-full" />
              ))}
            </div>
          ) : preferencesError ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
              <span>{preferencesError}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void preferencesQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_5rem_5rem] gap-3 border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Event</span>
                <span className="text-center">In-app</span>
                <span className="text-center">Email</span>
              </div>
              <ul className="divide-y divide-border">
                {preferences.map((preference) => {
                  const copy = TYPE_COPY[preference.type];
                  return (
                    <li
                      key={preference.type}
                      className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[1fr_5rem_5rem] sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">{copy.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {copy.description}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:justify-center">
                        <Checkbox
                          checked={preference.inApp}
                          onChange={(event) =>
                            toggle(
                              preference.type,
                              "inApp",
                              event.target.checked,
                            )
                          }
                          aria-label={`${copy.label} in-app notifications`}
                        />
                        <span className="sm:hidden">In-app</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm sm:justify-center">
                        <Checkbox
                          checked={preference.email}
                          onChange={(event) =>
                            toggle(
                              preference.type,
                              "email",
                              event.target.checked,
                            )
                          }
                          aria-label={`${copy.label} email notifications`}
                        />
                        <span className="sm:hidden">Email</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void save()} disabled={saving || !draft}>
                  {saving ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  Save preferences
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>History</CardTitle>
            <CardDescription>
              The last 50 notifications for this account.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex rounded-md border border-border p-0.5"
              role="group"
              aria-label="Filter notifications"
            >
              <Button
                size="sm"
                variant={filter === "all" ? "secondary" : "ghost"}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "unread" ? "secondary" : "ghost"}
                aria-pressed={filter === "unread"}
                onClick={() => setFilter("unread")}
              >
                Unread
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void markAllRead()}
              disabled={notifications.every((row) => row.read)}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all read
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-16 w-full" />
              ))}
            </div>
          ) : historyError ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
              <span>{historyError}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void historyQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filter === "unread"
                ? "No unread notifications."
                : "No notifications yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={
                          notification.read
                            ? "text-sm"
                            : "text-sm font-semibold"
                        }
                      >
                        {notification.title}
                      </p>
                      {!notification.read ? (
                        <Badge variant="secondary">Unread</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      title={formatDateTime(notification.createdAt)}
                    >
                      {formatRelative(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {safeNotificationLink(notification.link) ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={
                            safeNotificationLink(notification.link) ??
                            "/dashboard"
                          }
                        >
                          Open
                        </Link>
                      </Button>
                    ) : null}
                    {!notification.read ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void markRead(notification)}
                      >
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
