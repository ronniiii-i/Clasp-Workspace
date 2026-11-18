/** Notification links are rendered as same-origin relative paths only. */
export function safeNotificationLink(link: unknown): string | null {
  if (typeof link !== "string") return null;
  if (!link.startsWith("/")) return null;
  if (link.startsWith("//")) return null;
  return link;
}
