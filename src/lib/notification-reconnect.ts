/**
 * Reconnect policy for the notification SSE stream.
 *
 * The provider closes the connection on unmount/logout and owns a small retry
 * loop. These constants and helpers are pure so the policy can be unit tested
 * without opening a stream.
 */

export const NOTIFICATION_BACKOFF_BASE_MS = 1_000;
export const NOTIFICATION_BACKOFF_MAX_MS = 30_000;
/** After this many consecutive failures the provider polls instead. */
export const NOTIFICATION_MAX_RETRIES = 5;
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

/** 1s, 2s, 4s, 8s, 16s, 30s, 30s ... */
export function nextBackoffDelay(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt)
    ? Math.max(1, Math.floor(attempt))
    : 1;
  return Math.min(
    NOTIFICATION_BACKOFF_MAX_MS,
    NOTIFICATION_BACKOFF_BASE_MS * 2 ** (safeAttempt - 1),
  );
}

export function shouldFallbackToPolling(attempt: number): boolean {
  return attempt >= NOTIFICATION_MAX_RETRIES;
}
