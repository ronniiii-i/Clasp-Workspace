"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { isTenantAdminRole } from "@/lib/format";

const tabs = [
  { name: "General", href: "/settings" },
  { name: "Departments", href: "/settings/departments" },
  { name: "Roles & Permissions", href: "/settings/roles" },
  { name: "Billing", href: "/settings/billing" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const isTenantAdmin = isTenantAdminRole(
    user?.role as unknown as { isTenantAdmin?: boolean; slug?: string } | string,
  );

  // Settings are administrator-only. The sidebar already hides them for
  // everyone else, but a direct visit must not render the page.
  useEffect(() => {
    if (isLoading || !user) return;
    if (isTenantAdmin) return;
    toast.error("Settings are only available to tenant administrators.");
    router.replace("/dashboard");
  }, [isLoading, isTenantAdmin, router, user]);

  if (isLoading || !user || !isTenantAdmin) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace configuration.</p>
      </div>
      <nav
        aria-label="Settings sections"
        className="flex flex-wrap gap-2 border-b border-border"
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                active && "border-b border-foreground text-foreground"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
