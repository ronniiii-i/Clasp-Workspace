"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAccessibleModules } from "@/hooks/useAccessibleModules";
import type { Module } from "@/lib/modules";
import { cn } from "@/lib/utils";

/**
 * Friendly labels for the modules that expose CREATE. Unknown modules fall
 * back to "New <name>" so newly seeded modules appear automatically.
 */
const LABEL_RULES: Array<{ keywords: string[]; label: string }> = [
  { keywords: ["leave", "workflow"], label: "Request Leave" },
  { keywords: ["task"], label: "New Task" },
  { keywords: ["ticket"], label: "Raise Ticket" },
  { keywords: ["deal", "opportunit"], label: "New Deal" },
  { keywords: ["expense"], label: "New Expense" },
  { keywords: ["invoice"], label: "New Invoice" },
  { keywords: ["lead"], label: "New Lead" },
  { keywords: ["document"], label: "New Document" },
  { keywords: ["announcement"], label: "New Announcement" },
];

function actionLabel(module: Module): string {
  const haystack = `${module.name} ${module.key ?? ""} ${
    module.targetEntity ?? ""
  }`.toLowerCase();
  const rule = LABEL_RULES.find((entry) =>
    entry.keywords.some((keyword) => haystack.includes(keyword)),
  );
  if (rule) return rule.label;
  const singular = module.name.replace(/s$/, "");
  return `New ${singular}`;
}

/**
 * Dashboard-wide CREATE shortcuts. Every action is derived from the user's
 * ACL payload, so Staff, Leads, HODs and Admins only see modules they can
 * actually create in. Links deep-link with `?create=1`, which the data-table,
 * kanban, document, form and workflow renderers all understand.
 */
export function QuickActionsBar({ className }: { className?: string }) {
  const { modules } = useAccessibleModules();

  const actions = useMemo(() => {
    const seen = new Set<string>();
    return modules
      .filter((module) => module.actions?.includes("CREATE"))
      .filter((module) => module.isNavigable !== false)
      .filter(
        (module) =>
          module.path !== "/dashboard" && module.path !== "/notifications",
      )
      .filter((module) => {
        if (seen.has(module.path)) return false;
        seen.add(module.path);
        return true;
      })
      .slice(0, 8)
      .map((module) => ({
        path: module.path,
        label: actionLabel(module),
        href: `${module.path}${
          module.path.includes("?") ? "&" : "?"
        }create=1`,
      }));
  }, [modules]);

  if (actions.length === 0) return null;

  return (
    <section
      aria-label="Quick actions"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card/60 px-4 py-3 shadow-sm",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Zap className="size-3.5" aria-hidden="true" />
        Quick actions
      </span>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.path}
            asChild
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
          >
            <Link href={action.href} prefetch>
              <Plus className="mr-1 size-3.5" aria-hidden="true" />
              {action.label}
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
