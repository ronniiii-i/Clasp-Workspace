"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, FolderKanban, Settings, Users, CheckSquare, CalendarClock } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceFormat } from "@/hooks/useWorkspaceFormat";
import type { DepartmentOverview } from "@/services/departments";

export interface DepartmentCardProps {
  department: DepartmentOverview;
  className?: string;
}

export function DepartmentCard({ department, className }: DepartmentCardProps) {
  const params = useParams();
  const tenantSlug = (params?.tenant as string) ?? "";
  const format = useWorkspaceFormat();
  const user = useAuthStore((state) => state.user);

  const isTenantAdmin =
    user?.role === "TENANT_ADMIN" ||
    user?.role === "tenant_admin" ||
    (typeof user?.role === "object" &&
      (user?.role?.slug === "tenant_admin" || Boolean(user?.role?.isTenantAdmin)));

  const initials = department.manager?.name
    ? department.manager.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  const basePath = tenantSlug ? `/${tenantSlug}` : "";
  const openUrl = `${basePath}/departments/${encodeURIComponent(department.key)}`;
  const manageUrl = `${basePath}/settings/departments`;

  return (
    <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg tracking-tight truncate" title={department.name}>
                {department.name}
              </h3>
              {department.isSystem && (
                <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                  System
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              /dept/{department.key}
            </p>
          </div>
        </div>

        {department.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 min-h-[2.5rem]">
            {department.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic mt-2 min-h-[2.5rem]">
            No description provided.
          </p>
        )}
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        {/* Manager info */}
        <div className="flex items-center gap-2.5 pt-2 border-t">
          <Avatar className="h-7 w-7 text-xs">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="text-xs truncate">
            <span className="text-muted-foreground">Manager: </span>
            <span className="font-medium text-foreground">
              {department.manager?.name ?? "Unassigned"}
            </span>
          </div>
        </div>

        {/* Counts strip */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
            <Users className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="truncate">
              <div className="font-semibold text-foreground">
                {format.number(department.counts?.members ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">Members</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
            <FolderKanban className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="truncate">
              <div className="font-semibold text-foreground">
                {format.number(department.counts?.activeModules ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">Active Modules</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
            <CheckSquare className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="truncate">
              <div className="font-semibold text-foreground">
                {format.number(department.counts?.openTasks ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">Open Tasks</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
            <CalendarClock className="h-4 w-4 text-purple-500 shrink-0" />
            <div className="truncate">
              <div className="font-semibold text-foreground">
                {format.number(department.counts?.pendingLeave ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">Pending Leave</div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between gap-2 border-t mt-auto">
        <Button variant="default" size="sm" asChild className="flex-1">
          <Link href={openUrl}>
            Open
            <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>

        {isTenantAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link href={manageUrl} title="Manage department in settings">
              <Settings className="h-3.5 w-3.5" />
              <span className="sr-only">Manage</span>
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
