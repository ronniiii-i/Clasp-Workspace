import { safeNotificationLink } from "@/lib/notification-links";

describe("safeNotificationLink", () => {
  it("accepts same-origin relative paths", () => {
    expect(safeNotificationLink("/account/security")).toBe("/account/security");
    expect(
      safeNotificationLink("/dept/sales/contacts?open=abc"),
    ).toBe("/dept/sales/contacts?open=abc");
  });

  it("rejects absolute, protocol-relative and non-string links", () => {
    expect(safeNotificationLink("https://evil.test")).toBeNull();
    expect(safeNotificationLink("//evil.test/path")).toBeNull();
    expect(safeNotificationLink("javascript:alert(1)")).toBeNull();
    expect(safeNotificationLink(null)).toBeNull();
    expect(safeNotificationLink(42)).toBeNull();
  });
});
