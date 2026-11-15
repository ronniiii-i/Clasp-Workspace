"use client";

import { useEffect, useState, useMemo, useTransition } from "react";
import {
  Building2,
  CalendarClock,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
  Users,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DepartmentCard } from "@/components/departments/DepartmentCard";
import { CreateDepartmentWizard } from "@/components/departments/CreateDepartmentWizard";
import { getDepartmentsOverview, type DepartmentOverview } from "@/services/departments";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceFormat } from "@/hooks/useWorkspaceFormat";

export default function DepartmentsPage() {
  const format = useWorkspaceFormat();
  const user = useAuthStore((state) => state.user);

  const [departments, setDepartments] = useState<DepartmentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const isTenantAdmin =
    user?.role === "TENANT_ADMIN" ||
    user?.role === "tenant_admin" ||
    (typeof user?.role === "object" &&
      (user?.role?.slug === "tenant_admin" || Boolean(user?.role?.isTenantAdmin)));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartmentsOverview();
      setDepartments(res.departments || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load departments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Aggregated summary strip counts
  const summary = useMemo(() => {
    const totalDepartments = departments.length;
    let totalMembers = 0;
    let activeModules = 0;
    let pendingLeave = 0;

    departments.forEach((dept) => {
      totalMembers += dept.counts?.members ?? 0;
      activeModules += dept.counts?.activeModules ?? 0;
      pendingLeave += dept.counts?.pendingLeave ?? 0;
    });

    return {
      totalDepartments,
      totalMembers,
      activeModules,
      pendingLeave,
    };
  }, [departments]);

  // Filtered department list
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase().trim();
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(q) ||
        dept.key.toLowerCase().includes(q) ||
        (dept.description && dept.description.toLowerCase().includes(q)),
    );
  }, [departments, searchQuery]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview and provisioned workspaces across your organization.
          </p>
        </div>

        {isTenantAdmin && (
          <Button onClick={() => setWizardOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Create Department
          </Button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Departments
              </p>
              <p className="text-xl font-bold text-foreground">
                {loading ? <Skeleton className="h-6 w-12 mt-1" /> : format.number(summary.totalDepartments)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Members
              </p>
              <p className="text-xl font-bold text-foreground">
                {loading ? <Skeleton className="h-6 w-12 mt-1" /> : format.number(summary.totalMembers)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Active Modules
              </p>
              <p className="text-xl font-bold text-foreground">
                {loading ? <Skeleton className="h-6 w-12 mt-1" /> : format.number(summary.activeModules)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Pending Leave
              </p>
              <p className="text-xl font-bold text-foreground">
                {loading ? <Skeleton className="h-6 w-12 mt-1" /> : format.number(summary.pendingLeave)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search departments by name or key…"
            className="pl-9 h-9"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="shrink-0 h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading departments</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadData} className="ml-4">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading Skeleton Grid */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} className="p-5 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-8 w-full" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-9 w-full" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredDepartments.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
            <div className="p-3 bg-muted rounded-full">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">
              {searchQuery ? "No matching departments found" : "No departments provisioned"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? `No department matches "${searchQuery}". Try a different keyword.`
                : "Create a department to organise teams, access controls, and modular apps."}
            </p>
            {isTenantAdmin && !searchQuery && (
              <Button onClick={() => setWizardOpen(true)} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Create your first department
              </Button>
            )}
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Responsive Grid: 1 col (<sm), 2 cols (md), 3 cols (xl) */}
      {!loading && !error && filteredDepartments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDepartments.map((dept) => (
            <DepartmentCard key={dept.id || dept.key} department={dept} />
          ))}
        </div>
      )}

      {/* Creation Wizard Modal */}
      <CreateDepartmentWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          setWizardOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
