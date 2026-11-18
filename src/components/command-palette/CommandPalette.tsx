"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  ArrowRight,
  Bell,
  Building2,
  CornerDownLeft,
  FileText,
  Loader2,
  Plus,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { useAccessibleModules } from "@/hooks/useAccessibleModules";
import {
  loadCommandPaletteRecents,
  saveCommandPaletteRecent,
  type CommandPaletteRecent,
} from "@/lib/command-palette-recents";
import { isTenantAdminRole } from "@/lib/format";
import type { Module } from "@/lib/modules";
import type { SearchGroup } from "@/lib/workspace-types";
import { SearchService } from "@/services/search";
import { useAuthStore } from "@/stores/auth-store";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaletteTarget {
  id: string;
  kind: CommandPaletteRecent["kind"];
  title: string;
  subtitle?: string | null;
  href: string;
  moduleKey?: string | null;
  deptKey?: string | null;
}

function safePath(href: string | null | undefined): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  return href;
}

function deptKeyFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  return parts[0] === "dept" ? (parts[1] ?? null) : null;
}

function moduleDepartment(module: Module): string | null {
  const department = module.department;
  if (!department) return null;
  return typeof department === "string" ? department : department.name;
}

function matches(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function matchesAny(values: Array<string | null | undefined>, query: string) {
  return values.some((value) => matches(value ?? "", query));
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const params = useParams<{ dept?: string; module?: string }>();
  const user = useAuthStore((state) => state.user);
  const { modules } = useAccessibleModules();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recents, setRecents] = useState<CommandPaletteRecent[]>([]);
  const prefetchedPaths = useRef<Set<string>>(new Set());

  /** Warm a result's route once on hover/keyboard highlight, not on every render. */
  const prefetchHref = (href: string | null | undefined) => {
    const safe = safePath(href);
    if (!safe || prefetchedPaths.current.has(safe)) return;
    prefetchedPaths.current.add(safe);
    router.prefetch(safe);
  };

  const isAdmin = isTenantAdminRole(user?.role);
  const trimmed = query.trim();

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      return;
    }
    setRecents(loadCommandPaletteRecents());
  }, [open]);

  const search = useQuery({
    queryKey: ["workspace", "search", debouncedQuery],
    queryFn: ({ signal }) =>
      SearchService.search(debouncedQuery, { signal, limit: 5 }),
    enabled: open && debouncedQuery.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
    retry: 1,
  });

  const modulePaths = useMemo(
    () => new Set(modules.map((module) => module.path)),
    [modules],
  );
  const moduleKeys = useMemo(
    () =>
      new Set(modules.map((module) => module.key ?? module.id).filter(Boolean)),
    [modules],
  );
  const departmentKeys = useMemo(
    () =>
      new Set(
        modules
          .map((module) => deptKeyFromPath(module.path))
          .filter((key): key is string => Boolean(key)),
      ),
    [modules],
  );

  const visibleRecents = useMemo(
    () =>
      recents.filter((recent) => {
        if (recent.kind === "module") {
          return modulePaths.has(recent.href);
        }
        if (recent.kind === "department") {
          if (isAdmin) return true;
          const key = recent.deptKey ?? deptKeyFromPath(recent.href);
          return Boolean(key && departmentKeys.has(key));
        }
        const moduleKey = recent.moduleKey;
        if (moduleKey && moduleKeys.has(moduleKey)) return true;
        const path = recent.href.split("?")[0];
        return modulePaths.has(path);
      }),
    [recents, isAdmin, modulePaths, moduleKeys, departmentKeys],
  );

  const navigation = useMemo(() => {
    const filtered = trimmed
      ? modules.filter((module) =>
          matchesAny(
            [
              module.name,
              module.key,
              module.path,
              moduleDepartment(module),
              module.group,
            ],
            trimmed,
          ),
        )
      : modules;
    return filtered.slice(0, 12);
  }, [modules, trimmed]);

  const currentModule = useMemo(() => {
    const key = params?.module;
    if (!key) return null;
    return (
      modules.find(
        (module) =>
          (module.key ?? module.id) === key &&
          module.path.includes(`/${key}`),
      ) ?? null
    );
  }, [modules, params?.module]);

  const canCreate =
    Boolean(currentModule) &&
    currentModule?.type === "DATA_TABLE" &&
    (currentModule?.actions ?? []).includes("CREATE");

  const actions = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      href: string;
      icon: typeof Settings;
      visible: boolean;
      keywords: string[];
    }> = [
      {
        id: "create-record",
        title: "Create record",
        subtitle: currentModule?.name ?? "Current module",
        href: currentModule ? `${currentModule.path}?create=1` : "",
        icon: Plus,
        visible: canCreate,
        keywords: ["create", "new", "add", currentModule?.name ?? ""],
      },
      {
        id: "notifications",
        title: "Notification settings",
        subtitle: "In-app and email preferences",
        href: "/account/notifications",
        icon: Bell,
        visible: true,
        keywords: ["notifications", "email", "preferences", "alerts"],
      },
      {
        id: "security",
        title: "Account security",
        subtitle: "Sessions and password",
        href: "/account/security",
        icon: ShieldCheck,
        visible: true,
        keywords: ["security", "sessions", "password", "devices"],
      },
      {
        id: "settings",
        title: "Open workspace settings",
        subtitle: "Departments, roles and localization",
        href: "/settings",
        icon: Settings,
        visible: isAdmin,
        keywords: ["settings", "workspace", "admin", "departments", "roles"],
      },
    ];

    if (!trimmed) {
      return items.filter((item) => item.visible).slice(0, 4);
    }

    return items
      .filter((item) => item.visible)
      .filter((item) =>
        matchesAny([item.title, item.subtitle, ...item.keywords], trimmed),
      );
  }, [canCreate, currentModule, isAdmin, trimmed]);

  const showServerSearch = debouncedQuery.length >= MIN_SEARCH_LENGTH;
  const serverResult =
    showServerSearch && search.data?.query === debouncedQuery
      ? search.data
      : null;
  const serverGroups: SearchGroup[] = serverResult?.groups ?? [];
  const serverItemCount = serverGroups.reduce(
    (count, group) => count + group.items.length,
    0,
  );
  const isSearching =
    showServerSearch && search.isFetching && serverResult === null;
  const searchFailed = showServerSearch && search.isError;

  const noResults =
    showServerSearch &&
    !isSearching &&
    !searchFailed &&
    serverItemCount === 0 &&
    navigation.length === 0 &&
    actions.length === 0;

  const select = (target: PaletteTarget) => {
    const href = safePath(target.href);
    setRecents(
      saveCommandPaletteRecent({
        id: target.id,
        kind: target.kind,
        title: target.title,
        subtitle: target.subtitle ?? null,
        href: href ?? target.href,
        moduleKey: target.moduleKey ?? null,
        deptKey: target.deptKey ?? null,
      }),
    );
    onOpenChange(false);
    if (href) router.push(href);
  };

  const selectRecent = (recent: CommandPaletteRecent) => {
    const href = safePath(recent.href);
    if (!href) return;
    setRecents(
      saveCommandPaletteRecent({
        ...recent,
        href,
      }),
    );
    onOpenChange(false);
    router.push(href);
  };

  const selectModule = (module: Module) => {
    select({
      id: module.key ?? module.id,
      kind: "module",
      title: module.name,
      subtitle: moduleDepartment(module) ?? module.group ?? "Workspace",
      href: module.path,
      moduleKey: module.key ?? module.id,
      deptKey: deptKeyFromPath(module.path),
    });
  };

  const groups = serverGroups;

  /** cmdk highlights by value, so map every option value to its target route. */
  const hrefByValue = useMemo(() => {
    const map = new Map<string, string>();
    const put = (value: string, href: string | null | undefined) => {
      const safe = safePath(href);
      if (safe) map.set(value, safe);
    };
    for (const recent of visibleRecents) {
      put(`recent:${recent.kind}:${recent.id}`, recent.href);
    }
    for (const navModule of navigation) {
      put(`module:${navModule.id}`, navModule.path);
    }
    for (const group of groups) {
      for (const item of group.items) {
        put(
          `${group.type}:${group.moduleKey ?? ""}:${item.id}`,
          item.href ?? groupFallbackHref(group),
        );
      }
    }
    for (const action of actions) {
      put(`action:${action.id}`, action.href);
    }
    return map;
  }, [visibleRecents, navigation, groups, actions]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      onValueChange={(value) => prefetchHref(hrefByValue.get(value))}
      label="Command palette"
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]"
      contentClassName="fixed left-1/2 top-[8vh] z-50 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl"
      data-testid="command-palette"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search records, departments and documents…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          data-testid="command-palette-input"
          autoFocus
        />
        {isSearching ? (
          <Loader2
            className="size-4 shrink-0 animate-spin text-muted-foreground"
            aria-label="Searching"
          />
        ) : null}
      </div>

      <Command.List
        label="Command palette results"
        className="max-h-[60vh] overflow-y-auto overscroll-contain p-2"
      >
        {!trimmed && visibleRecents.length > 0 ? (
          <Command.Group heading="Recent">
            {visibleRecents.map((recent) => (
              <Command.Item
                key={`recent:${recent.kind}:${recent.id}`}
                value={`recent:${recent.kind}:${recent.id}`}
                onSelect={() => selectRecent(recent)}
                onMouseEnter={() => prefetchHref(recent.href)}
                onFocus={() => prefetchHref(recent.href)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{recent.title}</span>
                  {recent.subtitle ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {recent.subtitle}
                    </span>
                  ) : null}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {navigation.length > 0 ? (
          <Command.Group heading="Jump to">
            {navigation.map((module) => (
              <Command.Item
                key={`module:${module.id}`}
                value={`module:${module.id}`}
                onSelect={() => selectModule(module)}
                onMouseEnter={() => prefetchHref(module.path)}
                onFocus={() => prefetchHref(module.path)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{module.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {moduleDepartment(module) ?? module.group ?? "Workspace"}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Type at least {MIN_SEARCH_LENGTH} characters to search records,
            departments and documents.
          </div>
        ) : null}

        {isSearching ? (
          <div className="flex flex-col gap-2 px-3 py-3" aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-9 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : null}

        {searchFailed ? (
          <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm">
            <span className="text-muted-foreground">
              Search failed. Check your connection and retry.
            </span>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
              onClick={() => void search.refetch()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {groups.map((group, groupIndex) => (
          <Command.Group
            key={`${group.type}:${group.moduleKey ?? groupIndex}`}
            heading={groupHeading(group)}
          >
            {group.items.map((item) => (
              <Command.Item
                key={`${group.type}:${group.moduleKey ?? ""}:${item.id}`}
                value={`${group.type}:${group.moduleKey ?? ""}:${item.id}`}
                onMouseEnter={() =>
                  prefetchHref(item.href ?? groupFallbackHref(group))
                }
                onFocus={() =>
                  prefetchHref(item.href ?? groupFallbackHref(group))
                }
                onSelect={() =>
                  select({
                    id: item.id,
                    kind: group.type,
                    title: item.title,
                    subtitle: item.subtitle ?? null,
                    href: item.href ?? groupFallbackHref(group),
                    moduleKey: group.moduleKey ?? null,
                    deptKey: group.deptKey ?? null,
                  })
                }
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                {group.type === "department" ? (
                  <Building2
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : group.type === "document" ? (
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.title}</span>
                  {item.subtitle ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ))}

        {actions.length > 0 ? (
          <Command.Group heading="Actions">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Command.Item
                  key={`action:${action.id}`}
                  value={`action:${action.id}`}
                  onSelect={() => {
                    onOpenChange(false);
                    const href = safePath(action.href);
                    if (href) router.push(href);
                  }}
                  onMouseEnter={() => prefetchHref(action.href)}
                  onFocus={() => prefetchHref(action.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{action.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {action.subtitle}
                    </span>
                  </span>
                </Command.Item>
              );
            })}
          </Command.Group>
        ) : null}

        {noResults ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            No matches for “{trimmed}”.
          </div>
        ) : null}
      </Command.List>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1">↑</kbd>
            <kbd className="rounded border border-border px-1">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1">
              <CornerDownLeft className="size-3" aria-hidden="true" />
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1">esc</kbd>
            close
          </span>
        </span>
        <span className="hidden sm:inline">
          Search covers only modules you can open
        </span>
      </div>
    </Command.Dialog>
  );
}

function groupHeading(group: SearchGroup): string {
  if (group.type === "department") return "Departments";
  if (group.type === "document") {
    return group.moduleName ? `${group.moduleName} documents` : "Documents";
  }
  return group.moduleName ?? "Records";
}

function groupFallbackHref(group: SearchGroup): string {
  if (group.type === "department") {
    return group.items[0]?.href ?? "/departments";
  }
  if (group.deptKey && group.moduleKey) {
    return `/dept/${group.deptKey}/${group.moduleKey}`;
  }
  return "/dashboard";
}
