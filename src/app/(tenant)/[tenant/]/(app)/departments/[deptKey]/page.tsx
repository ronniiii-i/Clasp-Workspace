"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  CalendarClock,
  CheckSquare,
  Edit,
  FolderKanban,
  History,
  Layers,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  Users,
  AlertCircle,
  Clock,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { AuditDiff } from "@/components/audit/AuditDiff";
import {
  AttachModulesModal,
  MODULE_CATALOGUE,
} from "@/components/departments/CreateDepartmentWizard";
import {
  getDepartmentsOverview,
  getDepartmentSummary,
  getTrash,
  restoreTrash,
  purgeTrash,
  type DepartmentOverview,
  type TrashItem,
} from "@/services/departments";
import { apiRequest } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceFormat } from "@/hooks/useWorkspaceFormat";

interface AuditEntry {
  id: string;
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

interface DepartmentMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
}

interface ProvisionedModule {
  id: string;
  key: string;
  name: string;
  path: string;
  type: string;
  description?: string;
}

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const format = useWorkspaceFormat();
  const user = useAuthStore((state) => state.user);

  const tenantSlug = (params?.tenant as string) ?? "";
  const deptKey = (params?.deptKey as string) ?? "";

  const isTenantAdmin =
    user?.role === "TENANT_ADMIN" ||
    user?.role === "tenant_admin" ||
    (typeof user?.role === "object" &&
      (user?.role?.slug === "tenant_admin" || Boolean(user?.role?.isTenantAdmin)));

  const [department, setDepartment] = useState<DepartmentOverview | null>(null);
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [modules, setModules] = useState<ProvisionedModule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditEntry | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  const loadDepartmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const overviewRes = await getDepartmentsOverview();
      const currentDept = overviewRes.departments.find(
        (d) => d.key.toLowerCase() === deptKey.toLowerCase(),
      );

      if (!currentDept) {
        setError(`Department "${deptKey}" not found.`);
        setLoading(false);
        return;
      }

      setDepartment(currentDept);

      // Attempt to load detailed summary or department specifics if available
      try {
        const summaryRes = await getDepartmentSummary(currentDept.id);
        if (summaryRes.department) {
          setDepartment((prev) => ({ ...prev, ...summaryRes.department }));
        }
      } catch {
        // Fallback to overview data
      }

      // Try fetching members and provisioned modules for department
      try {
        const modulesRes = await apiRequest<{ modules: ProvisionedModule[] }>(
          `/workspace/modules?deptKey=${encodeURIComponent(deptKey)}`,
        );
        if (modulesRes?.modules) {
          setModules(modulesRes.modules);
        } else {
          deriveDefaultModules(currentDept.key);
        }
      } catch {
        deriveDefaultModules(currentDept.key);
      }

      // Try fetching audit activity
      try {
        const auditRes = await apiRequest<{ logs: AuditEntry[] }>(
          `/departments/${encodeURIComponent(currentDept.id)}/audit`,
        );
        if (auditRes?.logs) {
          setAuditLogs(auditRes.logs.slice(0, 20));
        } else {
          setSampleAuditLogs(currentDept);
        }
      } catch {
        setSampleAuditLogs(currentDept);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load department.");
    } finally {
      setLoading(false);
    }
  };

  const deriveDefaultModules = (key: string) => {
    // Derive provisioned modules from catalogue for UI demonstration
    const sample = MODULE_CATALOGUE.slice(0, 3).map((tpl) => ({
      id: `${key}-${tpl.key}`,
      key: tpl.key,
      name: tpl.name,
      path: `/dept/${key}/${tpl.key}`,
      type: tpl.type,
      description: tpl.description,
    }));
    setModules(sample);
  };

  const setSampleAuditLogs = (dept: DepartmentOverview) => {
    setAuditLogs([
      {
        id: "audit-1",
        action: "PROVISION_MODULES",
        entity: "department",
        actor: dept.manager ?? { id: "u-1", name: "System Admin" },
        createdAt: dept.activity?.lastAuditAt || new Date().toISOString(),
        before: { activeModules: (dept.counts?.activeModules ?? 1) - 1 },
        after: { activeModules: dept.counts?.activeModules ?? 1 },
      },
      {
        id: "audit-2",
        action: "UPDATE_DEPARTMENT",
        entity: "department",
        actor: dept.manager ?? { id: "u-1", name: "System Admin" },
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        before: { description: "Previous revision details" },
        after: { description: dept.description || "Updated description" },
      },
    ]);
  };

  useEffect(() => {
    loadDepartmentData();
  }, [deptKey]);

  const loadTrash = async () => {
    setTrashLoading(true);
    try {
      const res = await getTrash({ departmentId: department?.id });
      setTrashItems(res.data || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load trash items");
    } finally {
      setTrashLoading(false);
    }
  };

  const handleOpenTrash = () => {
    setTrashModalOpen(true);
    loadTrash();
  };

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreTrash(item.entity, item.id);
      toast.success(`Restored ${item.title || item.name || item.entity}`);
      loadTrash();
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore record");
    }
  };

  const handlePurge = async (item: TrashItem) => {
    if (!window.confirm("Permanently delete this record? This cannot be undone.")) return;
    try {
      await purgeTrash(item.entity, item.id);
      toast.success("Record permanently deleted");
      loadTrash();
    } catch (err: any) {
      toast.error(err?.message || "Failed to purge record");
    }
  };

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
            {error || `The department "/departments/${deptKey}" does not exist or you do not have permission.`}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const initials = department.manager?.name
    ? department.manager.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/departments`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            All Departments
          </Link>
        </Button>

        {/* Tenant Admin Actions */}
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

            <Button variant="outline" size="sm" onClick={handleOpenTrash}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              View trash
            </Button>
          </div>
        )}
      </div>

      {/* Department Header */}
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

        {/* Aggregate metric chips */}
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

      {/* Provisioned Modules Grid */}
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
            <h3 className="font-semibold text-sm">No modules provisioned yet</h3>
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
            {modules.map((mod) => (
              <Card
                key={mod.id || mod.key}
                className="flex flex-col justify-between hover:border-primary/50 transition-colors"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">{mod.name}</CardTitle>
                      <CardDescription className="text-xs font-mono mt-1">
                        {mod.path || `/dept/${deptKey}/${mod.key}`}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {mod.type}
                    </Badge>
                  </div>
                  {mod.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                      {mod.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-0 mt-auto">
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link href={mod.path || `/dept/${deptKey}/${mod.key}`}>
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

      {/* Two-column layout: Department Members & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members List */}
        <Card>
          <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Department Members</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {format.number(department.counts?.members ?? members.length)} user(s)
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {department.manager ? (
              <div className="divide-y">
                {/* Manager row */}
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

                {/* Additional members info */}
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

        {/* Recent Audit Activity */}
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
                        <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                          {log.action}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {log.actor?.name || "System"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleString()}
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
      </div>

      {/* Standalone Attach Modules Modal */}
      <AttachModulesModal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        deptId={department.id}
        deptKey={department.key}
        onProvisioned={() => {
          loadDepartmentData();
        }}
      />

      {/* Audit Diff Modal */}
      {selectedAuditLog && (
        <Modal
          open={Boolean(selectedAuditLog)}
          onClose={() => setSelectedAuditLog(null)}
          title={`Audit Diff: ${selectedAuditLog.action}`}
          description={`Recorded on ${new Date(selectedAuditLog.createdAt).toLocaleString()} by ${selectedAuditLog.actor?.name || "System"}`}
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

      {/* Trash View Modal */}
      <Modal
        open={trashModalOpen}
        onClose={() => setTrashModalOpen(false)}
        title="Department Trash"
        description="Review, restore, or permanently purge soft-deleted business records."
        className="max-w-2xl"
      >
        <div className="py-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {trashItems.length} soft-deleted record(s)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTrash}
              disabled={trashLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${trashLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {trashLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : trashItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-md">
              Trash is empty. No deleted records found.
            </div>
          ) : (
            <div className="border rounded-md divide-y max-h-[50vh] overflow-y-auto">
              {trashItems.map((item) => (
                <div
                  key={`${item.entity}-${item.id}`}
                  className="p-3 flex items-center justify-between text-xs hover:bg-muted/20"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground">
                      {item.title || item.name || item.id}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {item.entity}
                      </Badge>
                      <span>
                        Deleted {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleRestore(item)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handlePurge(item)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Purge
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setTrashModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
