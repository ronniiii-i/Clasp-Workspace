import {
  NOTIFICATION_BACKOFF_MAX_MS,
  NOTIFICATION_MAX_RETRIES,
  nextBackoffDelay,
  shouldFallbackToPolling,
} from "@/lib/notification-reconnect";

describe("notification reconnect policy", () => {
  it("backs off 1s, 2s, 4s, 8s and caps at 30s", () => {
    expect(nextBackoffDelay(1)).toBe(1_000);
    expect(nextBackoffDelay(2)).toBe(2_000);
    expect(nextBackoffDelay(3)).toBe(4_000);
    expect(nextBackoffDelay(4)).toBe(8_000);
    expect(nextBackoffDelay(5)).toBe(16_000);
    expect(nextBackoffDelay(6)).toBe(30_000);
    expect(nextBackoffDelay(20)).toBe(NOTIFICATION_BACKOFF_MAX_MS);
  });

  it("treats malformed attempt numbers defensively", () => {
    expect(nextBackoffDelay(0)).toBe(1_000);
    expect(nextBackoffDelay(-3)).toBe(1_000);
    expect(nextBackoffDelay(Number.NaN)).toBe(1_000);
  });

  it("switches to polling only after the retry budget is exhausted", () => {
    for (let attempt = 1; attempt < NOTIFICATION_MAX_RETRIES; attempt += 1) {
      expect(shouldFallbackToPolling(attempt)).toBe(false);
    }
    expect(shouldFallbackToPolling(NOTIFICATION_MAX_RETRIES)).toBe(true);
    expect(shouldFallbackToPolling(NOTIFICATION_MAX_RETRIES + 1)).toBe(true);
  });
});
