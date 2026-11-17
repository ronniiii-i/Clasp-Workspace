"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronUp, LogOut, UserRound, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Module } from "@/lib/modules";
import { initials, isTenantAdminRole, roleLabel } from "@/lib/format";
import {
  findActiveGroupKey,
  groupModules,
  isModuleActive,
  stripTenantPrefix,
} from "@/lib/workspace-navigation";
import { cn } from "@/lib/utils";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarLink } from "./SidebarLink";
import { useSidebar } from "./SidebarProvider";

const COLLAPSED_GROUPS_KEY = "sidebar_collapsed_groups";

function staticModule(
  name: string,
  path: string,
  icon: string,
  order: number,
  group = "Workspace",
): Module {
  return {
    id: `static:${path}`,
    key: path.slice(1),
    name,
    path,
    icon,
    group,
    order,
    type: "DASHBOARD_VIEW",
    actions: ["VIEW"],
  };
}

const DASHBOARD_LINK = staticModule(
  "Dashboard",
  "/dashboard",
  "layout-dashboard",
  0,
);

const ADMIN_LINKS = [
  staticModule(
    "Department Overviews",
    "/departments",
    "layout-dashboard",
    900,
    "Administration",
  ),
  staticModule(
    "User Management",
    "/user-management",
    "users",
    901,
    "Administration",
  ),
  staticModule("Audit Log", "/audit-log", "history", 902, "Administration"),
  staticModule("Settings", "/settings", "settings", 903, "Administration"),
];

/**
 * Dynamic workspace navigation.
 *
 * Modules come from the ACL payload (with the session fallback), grouped by
 * department and sorted by `department.sortOrder` then `module.order`. The
 * dashboard is pinned above the groups; administration links are only appended
 * for tenant admins.
 */
export function Sidebar() {
  const params = useParams();
  const pathname = usePathname();
  const tenant = params?.tenant as string | undefined;
  const { user, logout } = useAuth();
  const { modules } = usePermissions();
  const { open, close } = useSidebar();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  const tenantPath = stripTenantPrefix(pathname || "/", tenant);
  const isTenantAdmin = isTenantAdminRole(
    user?.role as unknown as
      | { isTenantAdmin?: boolean; slug?: string }
      | string,
  );

  const navModules = useMemo(() => {
    const list = [...(modules ?? [])].filter(
      (item) =>
        item.path !== DASHBOARD_LINK.path &&
        // The legacy `notifications` module points at `/notifications`, which
        // has no page; notifications live in the top bar and account menu.
        item.path !== "/notifications",
    );
    const seen = new Set(list.map((item) => item.path));

    const extras = isTenantAdmin ? ADMIN_LINKS : [];
    for (const extra of extras) {
      if (!seen.has(extra.path)) {
        list.push(extra);
        seen.add(extra.path);
      }
    }

    return list;
  }, [modules, isTenantAdmin]);

  const groups = useMemo(() => groupModules(navModules), [navModules]);
  const activeGroupKey = findActiveGroupKey(groups, tenantPath);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setCollapsed(parsed);
      }
    } catch {
      // Ignore malformed persisted state.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        COLLAPSED_GROUPS_KEY,
        JSON.stringify(collapsed),
      );
    } catch {
      // Storage may be unavailable in private modes.
    }
  }, [collapsed, hydrated]);

  // The active department always expands when navigation changes.
  useEffect(() => {
    if (!activeGroupKey) return;
    setCollapsed((previous) =>
      previous[activeGroupKey]
        ? { ...previous, [activeGroupKey]: false }
        : previous,
    );
  }, [activeGroupKey]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [tenantPath]);

  if (!user) return null;

  const toggleGroup = (key: string) => {
    setCollapsed((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const dashboardActive = isModuleActive(tenantPath, DASHBOARD_LINK.path);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      ) : null}
      <aside
        id="app-sidebar"
        data-open={open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:max-w-none md:translate-x-0 md:shrink-0 md:transition-none",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-6">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight"
            onClick={close}
          >
            Clasp Workspace
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close navigation"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-1">
            <SidebarLink
              module={DASHBOARD_LINK}
              active={dashboardActive}
              activeRef={dashboardActive ? activeRef : undefined}
            />
          </ul>
          <ul className="mt-3 flex flex-col gap-3">
            {groups.map((group) => (
              <SidebarGroup
                key={group.key}
                group={group}
                open={!collapsed[group.key]}
                isActive={(href) => isModuleActive(tenantPath, href)}
                onToggle={() => toggleGroup(group.key)}
                activeRef={activeRef}
              />
            ))}
          </ul>
        </nav>
        <div className="border-t border-border px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {initials(user.name, user.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {roleLabel(user.role)}
                  </span>
                </span>
                {user.roleEnhanced ? (
                  <Badge
                    variant="secondary"
                    aria-label="Role enhanced"
                    title="Your access is enhanced by groups or overrides."
                  >
                    Role+
                  </Badge>
                ) : null}
                <ChevronUp
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account/profile" onClick={close}>
                  <UserRound className="size-4" aria-hidden="true" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/notifications" onClick={close}>
                  <Bell className="size-4" aria-hidden="true" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  close();
                  void logout();
                }}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
