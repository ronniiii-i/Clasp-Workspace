import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

type DateInput = string | number | Date | null | undefined;

export interface WorkspaceFormatOptions {
  currency: string;
  currencySymbol?: string | null;
  dateFormat: string;
  timeZone: string;
  locale: string;
  weekStartsOn?: number;
}

export const DEFAULT_WORKSPACE_FORMAT: WorkspaceFormatOptions = {
  currency: "USD",
  currencySymbol: null,
  dateFormat: "d MMM yyyy",
  timeZone: "UTC",
  locale: "en-US",
  weekStartsOn: 1,
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_PATTERN = /(MMMM|MMM|MM|dd|d|yyyy)/g;

let currentFormat: WorkspaceFormatOptions = DEFAULT_WORKSPACE_FORMAT;

/**
 * Cache the workspace preferences for calls made outside React
 * (`record-utils`, dashboard helpers). The auth store updates this on login,
 * refresh, cached-session restore and logout.
 */
export function configureWorkspaceFormat(
  settings?: Partial<WorkspaceFormatOptions> | null,
): void {
  currentFormat = settings
    ? { ...DEFAULT_WORKSPACE_FORMAT, ...settings }
    : DEFAULT_WORKSPACE_FORMAT;
}

export function getWorkspaceFormat(): WorkspaceFormatOptions {
  return currentFormat;
}

function toDate(value: DateInput, dateOnly: boolean): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : dateOnly
          ? new Date(`${value}T12:00:00.000Z`)
          : parseISO(value);
  return isValid(date) ? date : null;
}

function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function zonedParts(date: Date, timeZone: string, locale: string) {
  const zone = safeTimeZone(timeZone);
  const base = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) =>
    base.find((part) => part.type === type)?.value ?? "";

  return {
    day: read("day"),
    month: read("month"),
    monthShort: new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      month: "short",
    }).format(date),
    monthLong: new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      month: "long",
    }).format(date),
    year: read("year"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function resolveArgs(
  optionsOrFallback?: WorkspaceFormatOptions | string,
  fallback = "—",
): { options: WorkspaceFormatOptions; fallback: string } {
  if (typeof optionsOrFallback === "string") {
    return { options: currentFormat, fallback: optionsOrFallback };
  }
  return { options: optionsOrFallback ?? currentFormat, fallback };
}

function formatDateInternal(
  value: DateInput,
  options: WorkspaceFormatOptions,
  fallback: string,
): string {
  const dateOnly = typeof value === "string" && DATE_ONLY_PATTERN.test(value);
  const date = toDate(value, dateOnly);
  if (!date) return fallback;

  const timeZone = dateOnly ? "UTC" : options.timeZone;
  const pieces = zonedParts(date, timeZone, options.locale);
  const pattern = options.dateFormat || DEFAULT_WORKSPACE_FORMAT.dateFormat;

  return pattern.replace(TOKEN_PATTERN, (token) => {
    switch (token) {
      case "yyyy":
        return pieces.year;
      case "MMMM":
        return pieces.monthLong;
      case "MMM":
        return pieces.monthShort;
      case "MM":
        return pieces.month;
      case "dd":
        return pieces.day.padStart(2, "0");
      case "d":
        return String(Number(pieces.day));
      default:
        return token;
    }
  });
}

/** `6 Nov 2026` — falls back to an em dash for missing/invalid values. */
export function formatDate(
  value: DateInput,
  optionsOrFallback?: WorkspaceFormatOptions | string,
  fallback = "—",
): string {
  const args = resolveArgs(optionsOrFallback, fallback);
  return formatDateInternal(value, args.options, args.fallback);
}

/** `6 Nov 2026, 14:08` in the workspace timezone. */
export function formatDateTime(
  value: DateInput,
  optionsOrFallback?: WorkspaceFormatOptions | string,
  fallback = "—",
): string {
  const args = resolveArgs(optionsOrFallback, fallback);
  const dateOnly = typeof value === "string" && DATE_ONLY_PATTERN.test(value);
  const date = toDate(value, dateOnly);
  if (!date) return args.fallback;

  const timeZone = dateOnly ? "UTC" : args.options.timeZone;
  const pieces = zonedParts(date, timeZone, args.options.locale);
  const time = `${pieces.hour.padStart(2, "0")}:${pieces.minute.padStart(2, "0")}`;
  return `${formatDateInternal(value, args.options, args.fallback)}, ${time}`;
}

/** `in 9 days` / `3 days ago` — relative to the user's local clock. */
export function formatRelative(
  value: DateInput,
  _optionsOrFallback?: WorkspaceFormatOptions | string,
  fallback = "—",
): string {
  const resolved = resolveArgs(_optionsOrFallback, fallback);
  const date = toDate(value, false);
  return date
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : resolved.fallback;
}

export function formatCurrency(
  value: number | string | null | undefined,
  optionsOrFallback?: WorkspaceFormatOptions | string,
  fallback = "—",
  settings: { compact?: boolean } = {},
): string {
  const args = resolveArgs(optionsOrFallback, fallback);
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return args.fallback;

  const options = args.options;
  if (options.currencySymbol) {
    const number = new Intl.NumberFormat(options.locale, {
      notation: settings.compact ? "compact" : "standard",
      maximumFractionDigits: settings.compact ? 1 : 2,
    }).format(numeric);
    return `${options.currencySymbol}${number}`;
  }

  try {
    return new Intl.NumberFormat(options.locale, {
      style: "currency",
      currency: options.currency,
      currencyDisplay: "narrowSymbol",
      notation: settings.compact ? "compact" : "standard",
      maximumFractionDigits: settings.compact ? 1 : 2,
    }).format(numeric);
  } catch {
    return `${options.currency} ${numeric}`;
  }
}

export function formatNumber(
  value: number | string | null | undefined,
  optionsOrFallback?: WorkspaceFormatOptions | string,
  fallback = "—",
  settings: { compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  const args = resolveArgs(optionsOrFallback, fallback);
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return args.fallback;
  return new Intl.NumberFormat(args.options.locale, {
    notation: settings.compact ? "compact" : "standard",
    maximumFractionDigits: settings.maximumFractionDigits ?? 2,
  }).format(numeric);
}

export function formatEnum(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function roleSlug(
  role?: string | { name?: string; slug?: string; isTenantAdmin?: boolean } | null,
): string {
  if (!role) return "";
  if (typeof role === "string") return role.toLowerCase();
  return (role.slug || role.name || "").toLowerCase();
}

/**
 * Roles arrive as an enum string in legacy sessions and as an object in
 * Phase 2 payloads. Render either shape without leaking `[object Object]`.
 */
export function roleLabel(
  role?: string | { name?: string; slug?: string; isTenantAdmin?: boolean } | null,
): string {
  if (!role) return "—";
  if (typeof role === "string") return formatEnum(role);
  if (role.isTenantAdmin) return role.name || "Tenant admin";
  return role.name || (role.slug ? formatEnum(role.slug) : "—");
}

export function isTenantAdminRole(
  role?: string | { isTenantAdmin?: boolean; slug?: string } | null,
): boolean {
  if (!role) return false;
  if (typeof role === "string") return role === "ADMIN" || role === "tenant_admin";
  return Boolean(role.isTenantAdmin) || role.slug === "tenant_admin";
}

export function slugify(value: string, separator = "-"): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");
}

export function initials(name?: string | null, email?: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
