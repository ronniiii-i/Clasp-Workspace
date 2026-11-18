"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "Profile", href: "/account/profile" },
  { name: "Security", href: "/account/security" },
  { name: "Notifications", href: "/account/notifications" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Account settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your profile, security and notification preferences.
          </p>
        </div>
        <nav
          aria-label="Account sections"
          className="flex flex-wrap gap-2 border-b border-border"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active && "border-b border-foreground text-foreground",
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
