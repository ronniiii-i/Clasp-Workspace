"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Edit,
  FolderKanban,
  History,
  Layers,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { AuditDiff } from "@/components/audit/AuditDiff";
import { ConfigureModuleButton } from "@/components/renderers/shared/ConfigureModuleDrawer";
import { AttachModulesModal } from "@/components/departments/CreateDepartmentWizard";
import {
  getDepartmentsOverview,
  getDepartmentSummary,
  type DepartmentOverview,
} from "@/services/departments";
import { WorkspaceService } from "@/services/workspace";
import { useAccessibleModules } from "@/hooks/useAccessibleModules";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceFormat } from "@/hooks/useWorkspaceFormat";
import { isTenantAdminRole } from "@/lib/format";
import type { WorkspaceRecord } from "@/lib/workspace-types";

interface AuditEntry extends WorkspaceRecord {
  action: string;
  entity: string;
  actor?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  createdAt: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

const AUDIT_MODULE_KEY = "audit-log";
const WORKSPACE_DEPT_KEY = "workspace";

export default function DepartmentDetailPage() {
  const params = useParams();
  const format = useWorkspaceFormat();
  const user = useAuthStore((state) => state.user);

  const tenantSlug = (params?.tenant as string) ?? "";
  const deptKey = (params?.deptKey as string) ?? "";

  const isTenantAdmin = isTenantAdminRole(user?.role);

  const { modules: accessibleModules } = useAccessibleModules();
  const canViewAudit = useMemo(
    () => accessibleModules.some((module) => module.key === AUDIT_MODULE_KEY),
    [accessibleModules],
  );

  const [department, setDepartment] = useState<DepartmentOverview | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditEntry | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attachModalOpen, setAttachModalOpen] = useState(false);

  const loadDepartmentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overviewRes = await getDepartmentsOverview();
      const currentDept = overviewRes.departments.find(
        (entry) => entry.key.toLowerCase() === deptKey.toLowerCase(),
      );

      if (!currentDept) {
        setError(`Department "${deptKey}" was not found.`);
        setDepartment(null);
        return;
      }

      setDepartment(currentDept);

      try {
        const summaryRes = await getDepartmentSummary(currentDept.id);
        if (summaryRes.department) {
          setDepartment((prev) =>
            prev ? { ...prev, ...summaryRes.department } : summaryRes.department,
          );
        }
      } catch {
        // The overview payload is already complete enough to render.
      }

      if (!canViewAudit) {
        setAuditLogs([]);
        return;
      }

      try {
        const page = await WorkspaceService.listRecords<AuditEntry>(
          WORKSPACE_DEPT_KEY,
          AUDIT_MODULE_KEY,
          {
            filters: [
              { field: "departmentId", op: "eq", value: currentDept.id },
            ],
            sort: { field: "createdAt", dir: "desc" },
            include: ["actor"],
            pageSize: 20,
          },
        );
        setAuditLogs(page.data);
      } catch {
        // Audit visibility can lag ACL changes; an empty feed is not fatal.
        setAuditLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load department.");
    } finally {
      setLoading(false);
    }
  }, [canViewAudit, deptKey]);

  useEffect(() => {
    void loadDepartmentData();
  }, [loadDepartmentData]);

  const modules = useMemo(() => {
    if (!department) return [];
    return accessibleModules.filter((module) => {
      const relation = module.department;
      if (!relation) return false;
      const key = typeof relation === "string" ? relation : relation.key;
      return key?.toLowerCase() === department.key.toLowerCase();
    });
  }, [accessibleModules, department]);

  const basePath = tenantSlug ? `/${tenantSlug}` : "";

  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-16 w-full" />
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/departments`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Departments
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Department Not Found</AlertTitle>
          <AlertDescription>
            {error ||
              `The department "/departments/${deptKey}" does not exist or you do not have permission.`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const initials = department.manager?.name
    ? department.manager.name
        .split(" ")
        .map((name) => name[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/departments`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            All Departments
          </Link>
        </Button>

        {isTenantAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttachModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add modules
            </Button>

            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}/settings/departments`}>
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit department
              </Link>
            </Button>

            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}/settings/trash`}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                View trash
              </Link>
            </Button>
          </div>
        )}
      </div>

      <Card className="border-l-4 border-l-primary shadow-sm">
        <CardHeader className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {department.name}
                </h1>
                {department.isSystem && (
                  <Badge variant="secondary" className="text-xs uppercase font-mono">
                    System Department
                  </Badge>
                )}
                <Badge variant="outline" className="font-mono text-xs">
                  /dept/{department.key}
                </Badge>
              </div>

              {department.description ? (
                <p className="text-sm text-muted-foreground max-w-3xl">
                  {department.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">
                  No description provided.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="font-semibold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-xs">
                <div className="text-muted-foreground">Department Head / Manager</div>
                <div className="font-semibold text-sm text-foreground">
                  {department.manager?.name ?? "Unassigned"}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-0 border-t bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="py-2">
            <div className="text-2xl font-bold text-foreground">
              {format.number(department.counts?.members ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Members</div>
          </div>
          <div className="py-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {format.number(department.counts?.activeModules ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Active Modules</div>
          </div>
          <div className="py-2">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {format.number(department.counts?.openTasks ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Open Tasks</div>
          </div>
          <div className="py-2">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {format.number(department.counts?.pendingLeave ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Pending Leave</div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Provisioned Modules</h2>
            <Badge variant="secondary" className="text-xs">
              {modules.length}
            </Badge>
          </div>

          {isTenantAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttachModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Provision Module
            </Button>
          )}
        </div>

        {modules.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <h3 className="font-semibold text-sm">No modules available yet</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Attach template modules to enable pipelines, data tables, or documents.
            </p>
            {isTenantAdmin && (
              <Button size="sm" onClick={() => setAttachModalOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Attach Modules
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => (
              <Card
                key={module.id || module.key}
                className="flex flex-col justify-between hover:border-primary/50 transition-colors"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {module.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-1">
                        {module.path}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {module.type && (
                        <Badge variant="outline" className="text-[10px]">
                          {module.type}
                        </Badge>
                      )}
                      {isTenantAdmin ? (
                        <ConfigureModuleButton
                          deptKey={department.key}
                          moduleKey={
                            module.key ?? module.path.split("/").filter(Boolean).pop() ?? ""
                          }
                          variant="ghost"
                        />
                      ) : null}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 mt-auto">
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link href={module.path}>
                      Open Module
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Department Members</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {format.number(department.counts?.members ?? 0)} user(s)
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {department.manager ? (
              <div className="divide-y">
                <div className="p-3.5 px-5 flex items-center justify-between hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 text-xs">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{department.manager.name}</div>
                      <div className="text-xs text-muted-foreground">Department Head</div>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[10px]">
                    Manager
                  </Badge>
                </div>

                <div className="p-4 text-center text-xs text-muted-foreground bg-muted/10">
                  Manage individual assignments and team roles in workspace settings.
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No members assigned to this department.
              </div>
            )}
          </CardContent>
        </Card>

        {canViewAudit && (
          <Card>
            <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Recent Audit Activity</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">Last 20 events</span>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No recent activity recorded for this department.
                </div>
              ) : (
                <div className="divide-y max-h-[360px] overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 px-5 flex items-center justify-between hover:bg-muted/20 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-[10px] px-1.5 py-0"
                          >
                            {log.action}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {log.actor?.name || "System"}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format.dateTime(log.createdAt)}
                        </div>
                      </div>

                      {(log.before || log.after) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={() => setSelectedAuditLog(log)}
                        >
                          View Diff
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AttachModulesModal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        deptId={department.id}
        deptKey={department.key}
        onProvisioned={() => {
          void loadDepartmentData();
        }}
      />

      {selectedAuditLog && (
        <Modal
          open={Boolean(selectedAuditLog)}
          onClose={() => setSelectedAuditLog(null)}
          title={`Audit Diff: ${selectedAuditLog.action}`}
          description={`Recorded on ${format.dateTime(selectedAuditLog.createdAt)} by ${
            selectedAuditLog.actor?.name || "System"
          }`}
          className="max-w-xl"
        >
          <div className="py-2 space-y-4">
            <AuditDiff
              before={selectedAuditLog.before}
              after={selectedAuditLog.after}
            />
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedAuditLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
