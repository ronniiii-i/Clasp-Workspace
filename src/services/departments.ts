import { apiRequest } from "./api-client";

export interface DepartmentCounts {
  members: number;
  teams: number;
  modules: number;
  activeModules: number;
  openTasks: number;
  overdueTasks: number;
  pendingLeave: number;
  documents: number;
}

export interface DepartmentOverview {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  sortOrder?: number;
  manager: { id: string; name: string } | null;
  counts: DepartmentCounts;
  activity: {
    lastAuditAt: string | null;
    openTaskDelta7d: number;
  };
}

export interface OverviewResult {
  success: boolean;
  departments: DepartmentOverview[];
  unassigned?: {
    openTasks: number;
    overdueTasks: number;
    openTaskDelta7d: number;
  };
}

export interface DepartmentSummaryResult {
  success: boolean;
  department: DepartmentOverview;
}

export interface CreateDepartmentInput {
  name: string;
  key: string;
  description?: string;
  managerId?: string;
  sortOrder?: number;
  moduleTemplates?: string[];
}

export interface CreateDepartmentResult {
  success: boolean;
  department: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    sortOrder: number;
    managerId: string | null;
  };
  createdModules?: Array<{
    id: string;
    key: string;
    name: string;
    path: string;
  }>;
  skippedModules?: string[];
}

export interface ProvisionModulesInput {
  templates?: string[];
  moduleTemplates?: string[];
}

export interface ProvisionModulesResult {
  success: boolean;
  created: Array<{
    id: string;
    key: string;
    name: string;
    path: string;
    type: string;
    targetEntity: string | null;
    departmentId: string | null;
  }>;
  skipped: string[];
  departmentId: string;
}

export interface TrashItem {
  entity: string;
  id: string;
  name?: string;
  title?: string;
  deletedAt: string;
  deletedBy?: {
    id: string;
    name: string;
  } | null;
  [key: string]: unknown;
}

export interface TrashResult {
  success: boolean;
  data: TrashItem[];
  counts: Record<string, number>;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export async function getDepartmentsOverview(): Promise<OverviewResult> {
  return apiRequest<OverviewResult>("/departments/overview", {
    errorMessage: "Failed to fetch departments overview",
  });
}

export async function getDepartmentSummary(
  deptId: string,
): Promise<DepartmentSummaryResult> {
  return apiRequest<DepartmentSummaryResult>(`/departments/${encodeURIComponent(deptId)}/summary`, {
    errorMessage: "Failed to fetch department summary",
  });
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<CreateDepartmentResult> {
  return apiRequest<CreateDepartmentResult>("/departments", {
    method: "POST",
    body: JSON.stringify(input),
    errorMessage: "Failed to create department",
  });
}

export async function provisionDepartmentModules(
  deptId: string,
  payload: ProvisionModulesInput | { templates: string[] },
): Promise<ProvisionModulesResult> {
  const templates = "templates" in payload && payload.templates ? payload.templates : payload.moduleTemplates ?? [];
  return apiRequest<ProvisionModulesResult>(
    `/workspace/departments/${encodeURIComponent(deptId)}/modules`,
    {
      method: "POST",
      body: JSON.stringify({
        templates,
        moduleTemplates: templates,
      }),
      errorMessage: "Failed to provision department modules",
    },
  );
}

export async function getTrash(
  query?: Record<string, unknown>,
): Promise<TrashResult> {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        params.set(key, String(val));
      }
    });
  }
  const qs = params.toString();
  return apiRequest<TrashResult>(`/workspace/trash${qs ? `?${qs}` : ""}`, {
    errorMessage: "Failed to fetch trash records",
  });
}

export async function restoreTrash(
  entity: string,
  id: string,
): Promise<{ success: boolean; message?: string }> {
  return apiRequest<{ success: boolean; message?: string }>(
    `/workspace/trash/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/restore`,
    {
      method: "POST",
      errorMessage: "Failed to restore record",
    },
  );
}

export async function purgeTrash(
  entity: string,
  id: string,
): Promise<{ success: boolean; message?: string }> {
  return apiRequest<{ success: boolean; message?: string }>(
    `/workspace/trash/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to permanently delete record",
    },
  );
}
