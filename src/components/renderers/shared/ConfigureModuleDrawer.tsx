"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useModuleDefinition } from "@/hooks/workspace/useModuleDefinition";
import { useUpdateModuleConfig } from "@/hooks/workspace/useWorkspaceAggregate";
import {
  MODULE_CONFIG_VERSION,
  type KanbanConfig,
  type ModuleDefinition,
  type TableColumnConfig,
  type TableConfig,
} from "@/lib/workspace-types";
import { ErrorState } from "./ErrorState";

type Priority = TableColumnConfig["priority"];

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: "primary", label: "Always visible" },
  { value: "secondary", label: "When space allows" },
  { value: "optional", label: "Compact screens only" },
];

/** `title` is an optional display override stored on the module config. */
function displayTitle(definition: ModuleDefinition | undefined): string {
  if (!definition) return "";
  const override = (definition.config as { title?: unknown } | undefined)?.title;
  return typeof override === "string" && override.trim()
    ? override
    : definition.name;
}

function initialColumns(definition: ModuleDefinition): TableColumnConfig[] {
  const config = definition.config as Partial<TableConfig> | undefined;
  if (config?.columns?.length) return config.columns;
  return (definition.entityMeta?.fields ?? []).map((field, index) => ({
    field: field.name,
    label: field.label,
    type: field.type,
    priority: index < 4 ? "primary" : index < 8 ? "secondary" : "optional",
  }));
}

function ConfigureModuleDrawer({
  deptKey,
  moduleKey,
  open,
  onClose,
}: {
  deptKey: string;
  moduleKey: string;
  open: boolean;
  onClose: () => void;
}) {
  const definitionQuery = useModuleDefinition(deptKey, moduleKey);
  const definition = definitionQuery.data;
  const update = useUpdateModuleConfig(deptKey, moduleKey);

  const [title, setTitle] = useState("");
  const [tableColumns, setTableColumns] = useState<TableColumnConfig[]>([]);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [kanbanColumns, setKanbanColumns] = useState<
    Array<{ value: string; label: string; color: string }>
  >([]);

  useEffect(() => {
    if (!definition || !open) return;
    setTitle(displayTitle(definition));
    if (definition.type === "DATA_TABLE") {
      setTableColumns(initialColumns(definition));
      setHiddenFields(new Set());
    }
    if (definition.type === "KANBAN_BOARD") {
      const config = definition.config as Partial<KanbanConfig> | undefined;
      setKanbanColumns(config?.columns ?? []);
    }
  }, [definition, open]);

  const allFields = useMemo(
    () =>
      (definition?.entityMeta?.fields ?? []).map((field) => ({
        field: field.name,
        label: field.label,
      })),
    [definition],
  );

  const visibleColumns = tableColumns.filter(
    (column) => !hiddenFields.has(column.field),
  );

  const save = () => {
    if (!definition) return;
    if (!title.trim()) {
      toast.error("Module title is required.");
      return;
    }

    let nextConfig: Record<string, unknown> = {
      ...(definition.config as unknown as Record<string, unknown>),
      title: title.trim(),
    };

    if (definition.type === "DATA_TABLE") {
      const config = definition.config as Partial<TableConfig>;
      nextConfig = {
        ...nextConfig,
        version: config?.version ?? MODULE_CONFIG_VERSION,
        entity: config?.entity ?? definition.targetEntity ?? null,
        columns: visibleColumns,
        defaultSort: config?.defaultSort ?? {
          field: visibleColumns[0]?.field ?? "id",
          dir: "asc",
        },
        pageSize: config?.pageSize ?? 20,
        searchFields: config?.searchFields ?? [],
        createEnabled: config?.createEnabled ?? true,
        filters: config?.filters ?? [],
      };
    } else if (definition.type === "KANBAN_BOARD") {
      const config = definition.config as Partial<KanbanConfig>;
      nextConfig = {
        ...nextConfig,
        version: config?.version ?? MODULE_CONFIG_VERSION,
        entity: config?.entity ?? definition.targetEntity ?? null,
        columns: kanbanColumns,
        secondaryColumns: config?.secondaryColumns ?? [],
        statusField: config?.statusField ?? "status",
        titleField: config?.titleField ?? "title",
        valueField: config?.valueField ?? null,
        assigneeField: config?.assigneeField ?? null,
        dueField: config?.dueField ?? null,
        allowCreate: config?.allowCreate ?? true,
        allowMove: config?.allowMove ?? true,
      };
    }

    update.mutate(nextConfig, {
      onSuccess: () => {
        toast.success("Module configuration saved.");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const isDataTable = definition?.type === "DATA_TABLE";
  const isKanban = definition?.type === "KANBAN_BOARD";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure module"
      description={`${deptKey} / ${moduleKey}`}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending || !definition}>
            {update.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </>
      }
    >
      {definitionQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : definitionQuery.isError || !definition ? (
        <ErrorState
          title="Could not load module configuration"
          message={definitionQuery.error?.message ?? "Module not found."}
          onRetry={() => void definitionQuery.refetch()}
        />
      ) : (
        <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
          <label className="flex flex-col gap-1.5">
            <Label htmlFor="configure-module-title">Module title</Label>
            <Input
              id="configure-module-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Display name for this module"
            />
          </label>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">{definition.type}</Badge>
            <span className="text-xs text-muted-foreground">
              Changes apply to every user with access to this module.
            </span>
          </div>

          {isDataTable ? (
            <div className="space-y-2">
              <div>
                <Label>Table columns</Label>
                <p className="text-xs text-muted-foreground">
                  Uncheck a column to hide it. Priority controls when it appears
                  on narrow screens.
                </p>
              </div>
              <div className="divide-y rounded-md border border-border">
                {allFields.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No field metadata is available for this module.
                  </p>
                ) : (
                  allFields.map((field) => {
                    const existing = tableColumns.find(
                      (column) => column.field === field.field,
                    );
                    const visible = !hiddenFields.has(field.field);
                    return (
                      <div
                        key={field.field}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`col-${field.field}`}
                            checked={visible}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              const next = new Set(hiddenFields);
                              if (checked) next.delete(field.field);
                              else next.add(field.field);
                              setHiddenFields(next);
                              if (checked && !existing) {
                                setTableColumns((current) => [
                                  ...current,
                                  {
                                    field: field.field,
                                    label: field.label,
                                    priority: "secondary",
                                  },
                                ]);
                              }
                            }}
                          />
                          <Label
                            htmlFor={`col-${field.field}`}
                            className="text-sm font-normal"
                          >
                            {field.label}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              {field.field}
                            </span>
                          </Label>
                        </div>
                        <Select
                          aria-label={`${field.label} priority`}
                          value={existing?.priority ?? "primary"}
                          disabled={!visible}
                          onChange={(event) => {
                            const priority = event.target.value as Priority;
                            setTableColumns((current) => {
                              const found = current.find(
                                (column) => column.field === field.field,
                              );
                              if (found) {
                                return current.map((column) =>
                                  column.field === field.field
                                    ? { ...column, priority }
                                    : column,
                                );
                              }
                              return [
                                ...current,
                                {
                                  field: field.field,
                                  label: field.label,
                                  priority,
                                },
                              ];
                            });
                          }}
                          className="h-8 w-48 text-xs"
                        >
                          {PRIORITIES.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {isKanban ? (
            <div className="space-y-2">
              <div>
                <Label>Stage labels</Label>
                <p className="text-xs text-muted-foreground">
                  Rename board columns without changing their underlying values.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {kanbanColumns.map((column, index) => (
                  <label key={column.value} className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {column.value}
                    </span>
                    <Input
                      value={column.label}
                      onChange={(event) =>
                        setKanbanColumns((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, label: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {!isDataTable && !isKanban ? (
            <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              This module type only supports a display title override.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/** Admin-only trigger. The server still enforces the permission on save. */
export function ConfigureModuleButton({
  deptKey,
  moduleKey,
  variant = "outline",
  size = "sm",
}: {
  deptKey: string;
  moduleKey: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        <Settings2 className="mr-2 size-4" />
        Configure
      </Button>
      {open ? (
        <ConfigureModuleDrawer
          deptKey={deptKey}
          moduleKey={moduleKey}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
