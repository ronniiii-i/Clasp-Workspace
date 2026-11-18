"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { CommandPaletteProvider } from "@/components/providers/CommandPaletteProvider";
import { NotificationsProvider } from "@/components/providers/NotificationsProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationsProvider>
      <CommandPaletteProvider>
        <DashboardShell>{children}</DashboardShell>
      </CommandPaletteProvider>
    </NotificationsProvider>
  );
}
