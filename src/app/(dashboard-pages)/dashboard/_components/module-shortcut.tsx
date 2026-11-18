"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { useAccessibleModules } from "@/hooks/useAccessibleModules";
import type { Module } from "@/lib/modules";
import { cn } from "@/lib/utils";

const EXCLUDED_PATHS = new Set(["/dashboard", "/notifications"]);
const STOP_WORDS = new Set([
  "total",
  "active",
  "open",
  "new",
  "my",
  "all",
  "pending",
  "completed",
  "complete",
  "average",
  "count",
  "number",
  "current",
  "monthly",
  "weekly",
  "this",
  "last",
  "period",
]);

/** Turn a metric/widget label into module-matching keywords. */
export function keywordsFromTitle(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Pure matcher shared by the hook and the shortcut row. */
function matchModule(modules: Module[], keywords: string[]): Module | undefined {
  const normalized = keywords.map((word) => word.toLowerCase());
  return modules.find((module) => {
    if (module.isNavigable === false) return false;
    if (EXCLUDED_PATHS.has(module.path)) return false;
    const haystack = [
      module.name,
      module.key ?? "",
      module.targetEntity ?? "",
      module.group ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return normalized.some((word) => haystack.includes(word));
  });
}

/** Words that identify a module from a widget title or metric label. */
export function useModulePathFor(keywords: string[]): string | null {
  const { modules } = useAccessibleModules();
  return matchModule(modules, keywords)?.path ?? null;
}

export function ModuleShortcut({
  href,
  label = "Open module",
  className,
}: {
  href: string | null;
  label?: string;
  className?: string;
}) {
  if (!href) return null;
  return (
    <Link
      href={href}
      prefetch
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {label}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

/**
 * Compact role-view shortcut row. Each entry maps keywords to an accessible
 * module, so links only appear for modules the user can actually open.
 */
export function ModuleShortcuts({
  items,
}: {
  items: Array<{ keywords?: string[]; label: string; href?: string }>;
}) {
  const { modules } = useAccessibleModules();
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      aria-label="Related modules"
    >
      {items.map((item, index) => (
        <ModuleShortcut
          key={`${item.href ?? item.keywords?.join("-") ?? index}-${index}`}
          href={
            item.href ??
            (item.keywords
              ? matchModule(modules, item.keywords)?.path ?? null
              : null)
          }
          label={item.label}
        />
      ))}
    </div>
  );
}
