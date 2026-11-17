"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/shared/ExportButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useWorkspaceRecordMutations,
  useWorkspaceRecords,
} from "@/hooks/workspace/useWorkspaceRecords";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useModuleContext } from "./ModuleContext";
import type { ModuleRendererProps } from "./types";
import type {
  FilterOperator,
  RecordFilter,
  TableConfig,
  TableFilterConfig,
  WorkspaceRecord,
} from "@/lib/workspace-types";
import { moduleLocation } from "@/lib/workspace-navigation";
import { cn } from "@/lib/utils";
import { CellValue } from "./shared/CellValue";
import { ErrorState } from "./shared/ErrorState";
import { RecordDrawer } from "./shared/RecordDrawer";
import { RecordFormDialog } from "./shared/RecordFormDialog";
import {
  columnsFromMeta,
  fieldMetaForColumn,
  formFieldsFromMeta,
  getPath,
  initialFormValues,
  isHiddenField,
  relationKeyFor,
} from "./shared/record-utils";
import { WorkspaceService } from "@/services/workspace";

interface FilterState {
  field: string;
  value: string;
}

type ColumnPriority = "primary" | "secondary" | "optional";

interface DisplayColumn {
  field: string;
  label: string;
  type?: string;
  sortable?: boolean;
  width?: number;
  priority: ColumnPriority;
}

/**
 * Infer mobile priorities when the descriptor does not set them: the first
 * column identifies the record, the second carries useful context and the rest
 * are optional below the `sm` breakpoint.
 */
function withPriorities(
  columns: Array<{
    field: string;
    label: string;
    type?: string;
    sortable?: boolean;
    width?: number;
    priority?: ColumnPriority;
  }>,
): DisplayColumn[] {
  return columns.map((column, index) => ({
    ...column,
    priority:
      column.priority ??
      (index === 0 ? "primary" : index === 1 ? "secondary" : "optional"),
  }));
}

function bodyCellClass(priority: ColumnPriority, isFirst: boolean) {
  return cn(
    priority === "optional" && "hidden sm:table-cell",
    isFirst &&
      "sticky left-0 z-10 bg-card group-hover:bg-muted/50 group-focus-within:bg-muted/50",
  );
}

function headCellClass(priority: ColumnPriority, isFirst: boolean) {
  return cn(
    "sticky top-0 z-20 bg-card",
    priority === "optional" && "hidden sm:table-cell",
    isFirst && "left-0 z-30",
  );
}

function filterOptions(
  filter: TableFilterConfig,
  enumValues?: string[],
): string[] {
  if (enumValues?.length) return enumValues;
  return filter.options ?? [];
}

export function DataTableRenderer({ definition }: ModuleRendererProps) {
  const { can, entityMeta } = useModuleContext();
  const config = definition.config as TableConfig;
  const { deptKey, moduleKey } = moduleLocation(definition);

  const columns = useMemo(() => {
    const raw =
      config.columns.length > 0 ? config.columns : columnsFromMeta(entityMeta);

    return raw.flatMap((column) => {
      const field = fieldMetaForColumn(entityMeta, column.field);
      if (isHiddenField(column.field, field)) return [];

      if (field?.reference) {
        return [
          {
            ...column,
            field: relationKeyFor(field.name, field.reference),
            label: column.label || field.label,
            type: "text",
            sortable: false,
            filterable: false,
          },
        ];
      }

      return [{ ...column, label: column.label || field?.label || column.field }];
    });
  }, [config.columns, entityMeta]);

  const displayColumns = useMemo(() => withPriorities(columns), [columns]);
  const isTouch = useMediaQuery("(pointer: coarse)");

  const filterDefs = useMemo<TableFilterConfig[]>(() => {
    if (config.filters.length > 0) return config.filters;
    return (
      entityMeta?.fields
        .filter((field) => field.filterable && field.enumValues?.length)
        .slice(0, 3)
        .map((field) => ({ field: field.name, label: field.label })) ?? []
    );
  }, [config.filters, entityMeta]);

  const searchable =
    config.searchFields.length > 0 || (entityMeta?.searchFields.length ?? 0) > 0;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(config.defaultSort);
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [detail, setDetail] = useState<WorkspaceRecord | null>(null);
  const [editing, setEditing] = useState<WorkspaceRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceRecord | null>(null);
  const [deepLinkId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("open");
  });
  const [createDeepLink] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("create") === "1";
  });

  // `?open=<id>` deep-links straight to a record drawer.
  useEffect(() => {
    if (!deepLinkId) return;
    let cancelled = false;

    WorkspaceService.getRecord(deptKey, moduleKey, deepLinkId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Record not found or unavailable.");
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("open");
          window.history.replaceState({}, "", url.toString());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deepLinkId, deptKey, moduleKey]);

  const closeDetail = () => {
    setDetail(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("open")) {
        url.searchParams.delete("open");
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryFilters: RecordFilter[] = useMemo(
    () =>
      filters
        .filter((filter) => filter.value !== "")
        .map((filter) => ({
          field: filter.field,
          op: "eq" as FilterOperator,
          value: filter.value,
        })),
    [filters],
  );

  // Dotted columns such as `actor.name` read included relation objects; ask
  // the backend for exactly those relations instead of returning bare ids.
  const relationIncludes = useMemo(() => {
    const relations = new Set(
      (entityMeta?.fields ?? [])
        .filter((field) => field.relation)
        .map((field) => field.name),
    );
    const included = new Set<string>();
    for (const column of displayColumns) {
      const [head] = column.field.split(".");
      if (head && relations.has(head)) included.add(head);
    }
    return Array.from(included);
  }, [displayColumns, entityMeta]);

  const records = useWorkspaceRecords(deptKey, moduleKey, {
    search: search || undefined,
    page,
    pageSize: config.pageSize || 25,
    sort,
    filters: queryFilters,
    include: relationIncludes.length > 0 ? relationIncludes : undefined,
  });

  const { create, update, remove } = useWorkspaceRecordMutations(
    deptKey,
    moduleKey,
  );

  const fields = useMemo(() => formFieldsFromMeta(entityMeta), [entityMeta]);
  const readOnly = entityMeta?.readOnly === true;
  const canCreate =
    can("CREATE") && config.createEnabled && Boolean(config.entity) && !readOnly;
  const canEdit = can("EDIT") && !readOnly;
  const canDelete = can("DELETE") && !readOnly;

  const initialValues = useMemo(
    () =>
      editing ? initialFormValues(fields, editing) : initialFormValues(fields),
    [editing, fields],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  // `?create=1` from the command palette opens the create dialog once the
  // module config and permissions have loaded.
  useEffect(() => {
    if (!createDeepLink || !canCreate) return;
    setEditing(null);
    setDialogOpen(true);
    const url = new URL(window.location.href);
    if (url.searchParams.has("create")) {
      url.searchParams.delete("create");
      window.history.replaceState({}, "", url.toString());
    }
  }, [createDeepLink, canCreate]);

  const openEdit = (row: WorkspaceRecord) => {
    setDetail(null);
    setEditing(row);
    setDialogOpen(true);
  };

  const submitForm = (values: Record<string, unknown>) => {
    if (editing) {
      update.mutate(
        { id: editing.id, body: values },
        {
          onSuccess: () => {
            toast.success("Record updated.");
            setDialogOpen(false);
            setEditing(null);
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    create.mutate(values, {
      onSuccess: () => {
        toast.success("Record created.");
        setDialogOpen(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Record deleted.");
        setDeleteTarget(null);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleReassigned = (updated: WorkspaceRecord) => {
    setDetail(updated);
    void records.refetch();
  };

  const changeFilter = (field: string, value: string) => {
    setPage(1);
    setFilters((current) => {
      const next = current.filter((entry) => entry.field !== field);
      return value ? [...next, { field, value }] : next;
    });
  };

  const toggleSort = (field: string) => {
    setPage(1);
    setSort((current) =>
      current?.field === field
        ? { field, dir: current.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const rows = records.data?.data ?? [];
  const meta = records.data?.meta;

  if (records.isError) {
    return (
      <ErrorState
        title="Could not load records"
        message={records.error.message}
        onRetry={() => void records.refetch()}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label={definition.name}>
      <div className="flex flex-wrap items-center gap-2">
        {searchable ? (
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search records…"
              aria-label="Search records"
              className="pl-8"
            />
          </div>
        ) : null}

        {filterDefs.map((filter) => {
          const enumValues = entityMeta?.fields.find(
            (field) => field.name === filter.field,
          )?.enumValues;
          const options = filterOptions(filter, enumValues);
          const value =
            filters.find((entry) => entry.field === filter.field)?.value ?? "";

          return (
            <Select
              key={filter.field}
              value={value}
              onChange={(event) =>
                changeFilter(filter.field, event.target.value)
              }
              aria-label={`Filter by ${filter.label}`}
              className="w-auto min-w-36"
            >
              <option value="">All {filter.label.toLowerCase()}</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {meta ? (
            <span className="text-xs text-muted-foreground">
              {meta.total} record{meta.total === 1 ? "" : "s"}
            </span>
          ) : null}
          {entityMeta?.exportable ? (
            <ExportButton
              deptKey={deptKey}
              moduleKey={moduleKey}
              filters={queryFilters}
              sort={sort}
            />
          ) : null}
          {canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden="true" />
              New record
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        <Table
          className="min-w-[720px]"
          containerClassName="max-h-[70vh] overflow-y-auto"
        >
          <TableHeader>
            <TableRow>
              {displayColumns.map((column, index) => {
                const active = sort?.field === column.field;
                return (
                  <TableHead
                    key={column.field}
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      active
                        ? sort?.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={headCellClass(column.priority, index === 0)}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.field)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {column.label}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="size-3 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </TableHead>
                );
              })}
              <TableHead className="sticky top-0 z-20 w-20 bg-card text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.isPending ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="group">
                  {displayColumns.map((column, index) => (
                    <TableCell
                      key={column.field}
                      className={bodyCellClass(column.priority, index === 0)}
                    >
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="ml-auto h-4 w-12" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={displayColumns.length + 1}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No records match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid="record-row"
                  data-record-id={row.id}
                  tabIndex={0}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetail(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDetail(row);
                    }
                  }}
                >
                  {displayColumns.map((column, index) => (
                    <TableCell
                      key={column.field}
                      className={bodyCellClass(column.priority, index === 0)}
                    >
                      <CellValue
                        value={getPath(row, column.field)}
                        columnType={column.type}
                        field={fieldMetaForColumn(entityMeta, column.field)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {isTouch ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11 sm:size-9"
                              aria-label={`Actions for ${columnTitle(row, displayColumns)}`}
                            >
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={() => setDetail(row)}>
                              <Eye className="size-4" aria-hidden="true" />
                              View
                            </DropdownMenuItem>
                            {canEdit ? (
                              <DropdownMenuItem onSelect={() => openEdit(row)}>
                                <Pencil className="size-4" aria-hidden="true" />
                                Edit
                              </DropdownMenuItem>
                            ) : null}
                            {canDelete ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeleteTarget(row)}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`View ${columnTitle(row, displayColumns)}`}
                            onClick={() => setDetail(row)}
                          >
                            <Eye aria-hidden="true" />
                          </Button>
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${columnTitle(row, displayColumns)}`}
                              onClick={() => openEdit(row)}
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${columnTitle(row, displayColumns)}`}
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {meta
            ? `Page ${meta.page} of ${meta.totalPages}`
            : records.isPending
              ? "Loading…"
              : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta || meta.page <= 1 || records.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta || meta.page >= meta.totalPages || records.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <RecordDrawer
        open={Boolean(detail)}
        onClose={closeDetail}
        title={detail ? columnTitle(detail, displayColumns) : definition.name}
        record={detail}
        meta={entityMeta}
        onEdit={canEdit && detail ? () => openEdit(detail) : undefined}
        deptKey={deptKey}
        moduleKey={moduleKey}
        canReassign={canEdit && entityMeta?.reassignable === true}
        canEdit={canEdit}
        attachmentsEnabled={definition.features?.attachments === true}
        onReassigned={handleReassigned}
      />

      <RecordFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit record" : "New record"}
        description={`${definition.name} · ${entityMeta?.label ?? config.entity ?? ""}`}
        fields={fields}
        initialValues={initialValues}
        submitLabel={editing ? "Save changes" : "Create record"}
        busy={create.isPending || update.isPending}
        error={
          (create.error as Error | null)?.message ??
          (update.error as Error | null)?.message ??
          null
        }
        onSubmit={submitForm}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete record"
        description="This action cannot be undone."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete{" "}
          <span className="font-medium text-foreground">
            {deleteTarget ? columnTitle(deleteTarget, displayColumns) : "this record"}
          </span>
          ?
        </p>
      </Modal>
    </section>
  );
}

/** First non-id column value, used for accessible action labels. */
function columnTitle(
  row: WorkspaceRecord,
  columns: Array<{ field: string; label: string }>,
): string {
  const first = columns[0];
  const value = first ? getPath(row, first.field) : undefined;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "this record";
}
