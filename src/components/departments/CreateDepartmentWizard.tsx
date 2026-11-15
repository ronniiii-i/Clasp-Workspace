"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  BookUser,
  Boxes,
  CheckSquare,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ReceiptText,
  TrendingUp,
  Loader2,
  Check,
  ChevronRight,
  ArrowLeft,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RelationSelect } from "@/components/renderers/shared/RelationSelect";
import { ModuleProvider, useOptionalModuleContext } from "@/components/renderers/ModuleContext";
import type { FieldDefinition } from "@/components/renderers/shared/record-utils";
import { createDepartment, provisionDepartmentModules } from "@/services/departments";

export interface DepartmentModuleTemplateDef {
  key: string;
  name: string;
  description: string;
  category: "records" | "people" | "finance" | "operations" | "documents";
  type: string;
  icon: any;
  recommendedRoles: string[];
}

export const MODULE_CATALOGUE: DepartmentModuleTemplateDef[] = [
  // Records
  {
    key: "deals",
    name: "Deals",
    description: "Five-stage sales pipeline board.",
    category: "records",
    type: "KANBAN_BOARD",
    icon: TrendingUp,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  {
    key: "dashboard",
    name: "Department dashboard",
    description: "KPI overview for the department.",
    category: "records",
    type: "DASHBOARD_VIEW",
    icon: LayoutDashboard,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  // People
  {
    key: "contacts",
    name: "Contacts",
    description: "Searchable customer and prospect directory.",
    category: "people",
    type: "DATA_TABLE",
    icon: BookUser,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  // Finance
  {
    key: "invoices",
    name: "Invoices",
    description: "Invoice ledger with currency-formatted amounts.",
    category: "finance",
    type: "DATA_TABLE",
    icon: ReceiptText,
    recommendedRoles: ["Tenant Admin", "Department Head"],
  },
  {
    key: "expenses",
    name: "Expenses",
    description: "Department expense register.",
    category: "finance",
    type: "DATA_TABLE",
    icon: Receipt,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead"],
  },
  // Operations
  {
    key: "tasks",
    name: "Tasks",
    description: "Assignable work items with due dates.",
    category: "operations",
    type: "DATA_TABLE",
    icon: CheckSquare,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  {
    key: "tickets",
    name: "Support tickets",
    description: "Customer support queue with status and priority.",
    category: "operations",
    type: "DATA_TABLE",
    icon: LifeBuoy,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  {
    key: "inventory",
    name: "Inventory",
    description: "Shared stock catalogue with reorder thresholds.",
    category: "operations",
    type: "DATA_TABLE",
    icon: Boxes,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  {
    key: "request-form",
    name: "Request form",
    description: "Generic intake form for ad-hoc requests.",
    category: "operations",
    type: "FORM_BUILDER",
    icon: ClipboardList,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
  // Documents
  {
    key: "documents",
    name: "Documents",
    description: "Markdown document hub for policies and SOPs.",
    category: "documents",
    type: "DOCUMENT_HUB",
    icon: FileText,
    recommendedRoles: ["Tenant Admin", "Department Head", "Team Lead", "Staff"],
  },
];

const CATEGORIES: Array<{ key: DepartmentModuleTemplateDef["category"]; label: string }> = [
  { key: "records", label: "Records" },
  { key: "people", label: "People" },
  { key: "finance", label: "Finance" },
  { key: "operations", label: "Operations" },
  { key: "documents", label: "Documents" },
];

function deriveKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 60);
}

const KEY_REGEX = /^[a-z][a-z0-9_]{1,59}$/;

const managerFieldDef: FieldDefinition = {
  name: "managerId",
  label: "Manager",
  type: "relation",
  reference: {
    entity: "users",
    field: "userId",
    label: "Manager",
    allowClear: true,
  },
};

// Safe wrapper for RelationSelect outside module context
function SafeRelationSelect({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const existingContext = useOptionalModuleContext();

  const element = (
    <RelationSelect
      field={managerFieldDef}
      value={value}
      onChange={(v) => onChange(typeof v === "string" ? v : "")}
      error={error}
      disabled={disabled}
      id="dept-manager"
    />
  );

  if (existingContext) return element;

  return (
    <ModuleProvider
      value={{
        definition: {
          id: "users-lookup",
          key: "tasks",
          name: "Tasks",
          path: "/dept/operations/tasks",
          type: "DATA_TABLE" as any,
          targetEntity: "tasks",
          config: { version: 1, entity: "tasks", columns: [] } as any,
          isNavigable: false,
          description: null,
          department: { id: "operations", key: "operations", name: "Operations" } as any,
          dataScope: "TENANT" as any,
          actions: [],
        },
        entityMeta: null,
        actions: new Set(),
        dataScope: "TENANT" as any,
        can: () => true,
      }}
    >
      {element}
    </ModuleProvider>
  );
}

export interface CreateDepartmentWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (deptKey: string) => void;
}

export function CreateDepartmentWizard({
  open,
  onClose,
  onCreated,
}: CreateDepartmentWizardProps) {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = (params?.tenant as string) ?? "";

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [isKeyManual, setIsKeyManual] = useState(false);
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setKey("");
      setIsKeyManual(false);
      setDescription("");
      setManagerId("");
      setSortOrder("");
      setSelectedTemplates(new Set());
      setErrors({});
      setSubmitting(false);
    }
  }, [open]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isKeyManual) {
      setKey(deriveKey(val));
    }
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: "" }));
    }
  };

  const handleKeyChange = (val: string) => {
    setIsKeyManual(true);
    setKey(val);
    if (errors.key) {
      setErrors((prev) => ({ ...prev, key: "" }));
    }
  };

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      errs.name = "Department name must be between 2 and 60 characters.";
    }

    if (!KEY_REGEX.test(key)) {
      errs.key =
        "Key must start with a lowercase letter, contain only lowercase alphanumeric characters and underscores, and be between 2 and 60 characters.";
    }

    if (description.length > 280) {
      errs.description = "Description cannot exceed 280 characters.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const toggleTemplate = (templateKey: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateKey)) {
        next.delete(templateKey);
      } else {
        next.add(templateKey);
      }
      return next;
    });
  };

  const handleSelectRecommendedCategory = (category: DepartmentModuleTemplateDef["category"]) => {
    const categoryTemplates = MODULE_CATALOGUE.filter((t) => t.category === category);
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      categoryTemplates.forEach((t) => next.add(t.key));
      return next;
    });
  };

  const handleCancel = () => {
    if (name || description || selectedTemplates.size > 0) {
      if (window.confirm("Are you sure you want to discard your changes?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        key: key.trim(),
        description: description.trim() || undefined,
        managerId: managerId.trim() || undefined,
        sortOrder: sortOrder !== "" ? Number(sortOrder) : undefined,
        moduleTemplates: Array.from(selectedTemplates),
      };

      const res = await createDepartment(payload);
      toast.success(`Department "${res.department?.name || name}" created successfully`);
      onClose();
      if (onCreated) {
        onCreated(key);
      } else {
        const targetPath = tenantSlug
          ? `/${tenantSlug}/departments/${key}`
          : `/departments/${key}`;
        router.push(targetPath);
      }
    } catch (err: any) {
      const message = err?.message || "Failed to create department.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={step === 1 ? "Create Department - Step 1: Details" : "Create Department - Step 2: Modules"}
      description={
        step === 1
          ? "Set up the basic details for the new department."
          : "Select initial primitive modules to provision for this department."
      }
      className="max-w-2xl"
    >
      <div className="py-2 space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-2 border-b pb-3 text-xs">
          <div
            className={`flex items-center gap-1.5 font-medium ${
              step === 1 ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step === 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              1
            </span>
            Details
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <div
            className={`flex items-center gap-1.5 font-medium ${
              step === 2 ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step === 2
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              2
            </span>
            Modules
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">
                Department Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Legal & Compliance"
                maxLength={60}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-key">
                Department Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dept-key"
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="e.g. legal"
                maxLength={60}
                className="font-mono text-sm"
                aria-invalid={Boolean(errors.key)}
              />
              <p className="text-[11px] text-muted-foreground">
                URL identifier: /dept/{key || "<key>"} (lowercase, letters, numbers, underscores)
              </p>
              {errors.key && (
                <p className="text-xs text-destructive">{errors.key}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="dept-description">Description</Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {description.length}/280
                </span>
              </div>
              <Textarea
                id="dept-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of this department's function..."
                maxLength={280}
                rows={3}
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-manager">Department Manager</Label>
              <SafeRelationSelect
                value={managerId}
                onChange={setManagerId}
                error={errors.managerId}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-sort">Sort Order</Label>
              <Input
                id="dept-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="e.g. 10"
                min={0}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-md">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {selectedTemplates.size} module{selectedTemplates.size === 1 ? "" : "s"} selected
                </span>
              </div>
              <span className="text-muted-foreground">
                Modules can also be provisioned later.
              </span>
            </div>

            <div className="space-y-5 max-h-[46vh] overflow-y-auto pr-1">
              {CATEGORIES.map((cat) => {
                const templates = MODULE_CATALOGUE.filter((t) => t.category === cat.key);
                if (templates.length === 0) return null;

                return (
                  <div key={cat.key} className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {cat.label}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2 text-primary"
                        onClick={() => handleSelectRecommendedCategory(cat.key)}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Select recommended
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.map((tpl) => {
                        const isSelected = selectedTemplates.has(tpl.key);
                        const Icon = tpl.icon;
                        const previewPath = `/dept/${key || "<deptKey>"}/${tpl.key}`;

                        return (
                          <div
                            key={tpl.key}
                            onClick={() => toggleTemplate(tpl.key)}
                            className={`flex flex-col justify-between p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:border-muted-foreground/30 hover:bg-muted/30"
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-1.5 rounded-md ${
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <span className="font-medium text-sm">
                                    {tpl.name}
                                  </span>
                                </div>
                                <div
                                  className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-primary border-primary text-primary-foreground"
                                      : "border-muted-foreground"
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {tpl.description}
                              </p>
                            </div>

                            <div className="pt-2 mt-2 border-t flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-muted-foreground truncate">
                                {previewPath}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {tpl.type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Review summary footer */}
            <div className="rounded-md border p-3 bg-muted/20 text-xs space-y-1">
              <div className="font-semibold text-foreground">Review Summary</div>
              <div className="text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <span className="block text-[10px] uppercase">Name</span>
                  <span className="font-medium text-foreground">{name || "—"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Key</span>
                  <span className="font-mono text-foreground">{key || "—"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Manager</span>
                  <span className="text-foreground">{managerId ? "Assigned" : "None"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Modules</span>
                  <span className="text-foreground font-semibold">
                    {selectedTemplates.size} selected
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          {step === 2 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}

          <div className="flex items-center gap-2">
            {step === 1 ? (
              <Button type="button" size="sm" onClick={handleNext}>
                Next: Modules
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Department"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Standalone Step-2 modal variant for attaching templates
export interface AttachModulesModalProps {
  open: boolean;
  onClose: () => void;
  deptId: string;
  deptKey: string;
  onProvisioned?: (created: any[]) => void;
}

export function AttachModulesModal({
  open,
  onClose,
  deptId,
  deptKey,
  onProvisioned,
}: AttachModulesModalProps) {
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedTemplates(new Set());
      setSubmitting(false);
    }
  }, [open]);

  const toggleTemplate = (templateKey: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateKey)) {
        next.delete(templateKey);
      } else {
        next.add(templateKey);
      }
      return next;
    });
  };

  const handleSelectRecommendedCategory = (category: DepartmentModuleTemplateDef["category"]) => {
    const categoryTemplates = MODULE_CATALOGUE.filter((t) => t.category === category);
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      categoryTemplates.forEach((t) => next.add(t.key));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting || selectedTemplates.size === 0) return;
    setSubmitting(true);

    try {
      const res = await provisionDepartmentModules(deptId, {
        templates: Array.from(selectedTemplates),
      });

      toast.success(
        `Provisioned ${res.created?.length ?? 0} module(s)${
          res.skipped?.length ? ` (${res.skipped.length} skipped)` : ""
        }`,
      );
      onClose();
      onProvisioned?.(res.created ?? []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to attach modules.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach Modules"
      description={`Select module templates to provision for /dept/${deptKey}.`}
      className="max-w-2xl"
    >
      <div className="py-2 space-y-4">
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {CATEGORIES.map((cat) => {
            const templates = MODULE_CATALOGUE.filter((t) => t.category === cat.key);
            if (templates.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-primary"
                    onClick={() => handleSelectRecommendedCategory(cat.key)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Select recommended
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplates.has(tpl.key);
                    const Icon = tpl.icon;
                    const previewPath = `/dept/${deptKey}/${tpl.key}`;

                    return (
                      <div
                        key={tpl.key}
                        onClick={() => toggleTemplate(tpl.key)}
                        className={`flex flex-col justify-between p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:border-muted-foreground/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-md ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="font-medium text-sm">
                                {tpl.name}
                              </span>
                            </div>
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {tpl.description}
                          </p>
                        </div>

                        <div className="pt-2 mt-2 border-t flex flex-col gap-1">
                          <span className="text-[10px] font-mono text-muted-foreground truncate">
                            {previewPath}
                          </span>
                          <Badge variant="outline" className="text-[9px] w-fit px-1 py-0">
                            {tpl.type}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || selectedTemplates.size === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Attaching…
              </>
            ) : (
              `Attach ${selectedTemplates.size} Module(s)`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
