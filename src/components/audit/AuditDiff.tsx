"use client";

import { useMemo } from "react";
import { humanizeKey } from "@/components/renderers/shared/record-utils";
import { cn } from "@/lib/utils";

export interface AuditDiffProps {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  className?: string;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "ip",
  "useragent",
  "entityid",
  "before",
  "after",
]);

function isSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || lower.includes("password") || lower.includes("secret") || lower.includes("token");
}

function formatValue(value: unknown, isRedacted = false): string {
  if (isRedacted) return "[redacted]";
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    // Check if ISO date
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleString();
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => formatValue(item, false)).join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "—";
    return entries
      .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v, isSensitive(k))}`)
      .join("; ");
  }
  return String(value);
}

export function AuditDiff({ before, after, className }: AuditDiffProps) {
  const diffEntries = useMemo(() => {
    const beforeObj = before && typeof before === "object" ? before : {};
    const afterObj = after && typeof after === "object" ? after : {};

    const allKeys = Array.from(
      new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]),
    ).sort();

    return allKeys.map((key) => {
      const sensitive = isSensitive(key);
      const beforeRaw = (beforeObj as Record<string, unknown>)[key];
      const afterRaw = (afterObj as Record<string, unknown>)[key];

      const beforeFormatted = formatValue(beforeRaw, sensitive);
      const afterFormatted = formatValue(afterRaw, sensitive);
      const isChanged = beforeFormatted !== afterFormatted;

      return {
        key,
        label: humanizeKey(key),
        beforeFormatted,
        afterFormatted,
        isChanged,
        hasBefore: key in beforeObj,
        hasAfter: key in afterObj,
      };
    });
  }, [before, after]);

  if (diffEntries.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground italic py-2", className)}>
        No field changes recorded.
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-md border text-sm", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="py-2 px-3 w-1/3">Field</th>
            <th className="py-2 px-3 w-1/3">Before</th>
            <th className="py-2 px-3 w-1/3">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {diffEntries.map((row) => (
            <tr
              key={row.key}
              className={cn(
                "transition-colors",
                row.isChanged ? "bg-amber-500/5 dark:bg-amber-500/10" : "hover:bg-muted/20",
              )}
            >
              <td className="py-2 px-3 font-medium text-foreground">
                {row.label}
              </td>
              <td
                className={cn(
                  "py-2 px-3 break-words",
                  row.isChanged && row.hasBefore
                    ? "text-red-600 dark:text-red-400 font-mono text-xs"
                    : "text-muted-foreground",
                )}
              >
                {row.beforeFormatted}
              </td>
              <td
                className={cn(
                  "py-2 px-3 break-words",
                  row.isChanged && row.hasAfter
                    ? "text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {row.afterFormatted}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
