import {
  DEFAULT_WORKSPACE_FORMAT,
  configureWorkspaceFormat,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  getWorkspaceFormat,
  type WorkspaceFormatOptions,
} from "@/lib/format";

const lagos: WorkspaceFormatOptions = {
  ...DEFAULT_WORKSPACE_FORMAT,
  currency: "NGN",
  currencySymbol: "₦",
  dateFormat: "dd/MM/yyyy",
  timeZone: "Africa/Lagos",
  locale: "en-NG",
};

describe("workspace formatting", () => {
  afterEach(() => {
    configureWorkspaceFormat(null);
  });

  it("formats a date-only value as a calendar date", () => {
    expect(formatDate("2026-11-06")).toBe("6 Nov 2026");
  });

  it("does not shift a date-only value into the previous day", () => {
    expect(
      formatDate("2026-01-01", {
        ...DEFAULT_WORKSPACE_FORMAT,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("1 Jan 2026");
  });

  it("applies the configured date pattern", () => {
    expect(
      formatDate("2026-11-06", { ...lagos, dateFormat: "yyyy-MM-dd" }),
    ).toBe("2026-11-06");
    expect(
      formatDate("2026-11-06", { ...lagos, dateFormat: "MM/dd/yyyy" }),
    ).toBe("11/06/2026");
  });

  it("renders long month names", () => {
    expect(
      formatDate("2026-11-06", { ...lagos, dateFormat: "d MMMM yyyy" }),
    ).toBe("6 November 2026");
  });

  it("converts timestamps into the workspace timezone", () => {
    const value = "2026-11-06T23:30:00.000Z";
    expect(formatDate(value, lagos)).toBe("07/11/2026");
    expect(formatDateTime(value, lagos)).toBe("07/11/2026, 00:30");
  });

  it("keeps the legacy fallback argument working", () => {
    expect(formatDate(null, "n/a")).toBe("n/a");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats currency with the workspace locale and symbol", () => {
    expect(formatCurrency(1250000, lagos)).toBe("₦1,250,000");
    expect(
      formatCurrency(2500, { ...lagos, currencySymbol: null }),
    ).toContain("₦");
  });

  it("formats compact currency for dashboard metrics", () => {
    expect(
      formatCurrency(1_250_000, DEFAULT_WORKSPACE_FORMAT, "—", {
        compact: true,
      }),
    ).toBe("$1.3M");
  });

  it("formats numbers with the workspace locale", () => {
    expect(formatNumber(1234567.89, lagos)).toBe("1,234,567.89");
    expect(formatNumber(1234.5, lagos, "—", { maximumFractionDigits: 0 })).toBe(
      "1,235",
    );
    expect(formatNumber(undefined)).toBe("—");
  });

  it("caches module-level defaults for non-React callers", () => {
    configureWorkspaceFormat(lagos);
    expect(getWorkspaceFormat().currency).toBe("NGN");
    expect(formatDate("2026-11-06")).toBe("06/11/2026");

    configureWorkspaceFormat(null);
    expect(getWorkspaceFormat()).toEqual(DEFAULT_WORKSPACE_FORMAT);
    expect(formatDate("2026-11-06")).toBe("6 Nov 2026");
  });
});
