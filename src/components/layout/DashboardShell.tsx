"use client";

import { Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useCommandPalette } from "@/components/providers/CommandPaletteProvider";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const { openPalette } = useCommandPalette();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="text-sm text-muted-foreground">{user?.tenantName || ""}</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden gap-2 text-muted-foreground md:inline-flex"
              onClick={openPalette}
              aria-label="Open command palette"
              data-testid="command-palette-trigger"
            >
              <Search className="size-4" aria-hidden="true" />
              <span>Search</span>
              <kbd className="ml-4 rounded border border-border px-1 text-[10px] font-medium">
                Ctrl K
              </kbd>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={openPalette}
              aria-label="Open command palette"
            >
              <Search className="size-4" aria-hidden="true" />
            </Button>
            <NotificationCenter />
            <ThemeToggle />
            <div className="text-sm text-muted-foreground">{user?.name}</div>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
