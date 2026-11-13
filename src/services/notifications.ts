import { apiRequest } from "./api-client";
import type {
  NotificationListResponse,
  NotificationPreferencesResponse,
  NotificationUnreadResponse,
  UpdateNotificationPreferencesInput,
} from "@/lib/workspace-types";

export interface NotificationListQuery {
  unread?: boolean;
  limit?: number;
}

/** In-app notification inbox, read state and per-type preferences. */
export class NotificationsService {
  static async list(
    options: NotificationListQuery = {},
  ): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    if (options.unread) params.set("unread", "true");
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    const suffix = params.toString();

    return apiRequest<NotificationListResponse>(
      `/notifications${suffix ? `?${suffix}` : ""}`,
      { errorMessage: "Could not load notifications" },
    );
  }

  static async unreadCount(): Promise<NotificationUnreadResponse> {
    return apiRequest<NotificationUnreadResponse>("/notifications/unread-count", {
      errorMessage: "Could not load the unread count",
    });
  }

  static async markRead(id: string): Promise<{ success: true }> {
    return apiRequest<{ success: true }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      {
        method: "PATCH",
        errorMessage: "Could not mark the notification as read",
      },
    );
  }

  static async markAllRead(): Promise<{ success: true; updated: number }> {
    return apiRequest<{ success: true; updated: number }>(
      "/notifications/read-all",
      {
        method: "POST",
        errorMessage: "Could not mark notifications as read",
      },
    );
  }

  static async getPreferences(): Promise<NotificationPreferencesResponse> {
    return apiRequest<NotificationPreferencesResponse>(
      "/notifications/preferences",
      { errorMessage: "Could not load notification preferences" },
    );
  }

  static async updatePreferences(
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferencesResponse> {
    return apiRequest<NotificationPreferencesResponse>(
      "/notifications/preferences",
      {
        method: "PATCH",
        body: JSON.stringify(input),
        errorMessage: "Could not save notification preferences",
      },
    );
  }
}
