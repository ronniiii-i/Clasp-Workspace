"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { CommandPaletteProvider } from "@/components/providers/CommandPaletteProvider";
import { NotificationsProvider } from "@/components/providers/NotificationsProvider";
import { useAuthStore } from "@/stores/auth-store";
import { isTenantAdminRole } from "@/lib/format";

export default function TenantAppClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, token, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const locked =
    user?.tenantStatus === "PAST_DUE" || user?.tenantStatus === "SUSPENDED";

  useEffect(() => {
    if (!isLoading && !token) {
      router.push("/login");
    } else if (!isLoading && user && locked) {
      router.push(
        isTenantAdminRole(user.role) ? "/settings/billing" : "/account-locked",
      );
    }
  }, [isLoading, token, user, locked, router]);

  if (isLoading || !token || !user) {
    return null;
  }

  if (locked) {
    return null;
  }

  return (
    <NotificationsProvider>
      <CommandPaletteProvider>
        <DashboardShell>{children}</DashboardShell>
      </CommandPaletteProvider>
    </NotificationsProvider>
  );
}
