"use client";

import { Menu, Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { SidebarProvider, useSidebar } from "@/components/sidebar/SidebarProvider";
import ThemeToggle from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useCommandPalette } from "@/components/providers/CommandPaletteProvider";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

function MobileBar() {
  const { user } = useAuthStore();
  const { open, toggle, triggerRef } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Open navigation"
          aria-controls="app-sidebar"
          aria-expanded={open}
          data-testid="mobile-nav-trigger"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
        <span className="truncate text-sm font-semibold">
          {user?.tenantName || "Clasp Workspace"}
        </span>
      </div>
      <NotificationCenter />
    </header>
  );
}

function DesktopHeader() {
  const { user } = useAuthStore();
  const { openPalette } = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-6 backdrop-blur md:flex">
      <div className="text-sm text-muted-foreground">{user?.tenantName || ""}</div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
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
        <NotificationCenter />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar />
          <DesktopHeader />
          <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
