"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, GripVertical, Pencil, Plus, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWorkspaceRecordMutations,
  useWorkspaceRecords,
} from "@/hooks/workspace/useWorkspaceRecords";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useModuleContext } from "./ModuleContext";
import type { ModuleRendererProps } from "./types";
import type {
  KanbanColumnConfig,
  KanbanConfig,
  WorkspaceRecord,
} from "@/lib/workspace-types";
import { moduleLocation } from "@/lib/workspace-navigation";
import { cn } from "@/lib/utils";
import { CellValue } from "./shared/CellValue";
import { ErrorState } from "./shared/ErrorState";
import { RecordFormDialog } from "./shared/RecordFormDialog";
import { RecordDrawer } from "./shared/RecordDrawer";
import { WorkspaceService } from "@/services/workspace";
import {
  fieldMetaForColumn,
  formFieldsFromMeta,
  formatCellText,
  getPath,
  initialFormValues,
  relationValueFor,
} from "./shared/record-utils";
import type { EntityMeta } from "@/lib/workspace-types";

const COLUMN_TONES: Record<string, string> = {
  slate: "border-t-slate-400",
  blue: "border-t-blue-500",
  violet: "border-t-violet-500",
  emerald: "border-t-emerald-500",
  amber: "border-t-amber-500",
  rose: "border-t-rose-500",
};

function columnTone(color: string | undefined): string {
  return COLUMN_TONES[color ?? ""] ?? "border-t-border";
}

function cardTitle(
  row: WorkspaceRecord,
  config: KanbanConfig,
  fallback: string,
  meta: EntityMeta | null,
): string {
  const field = config.titleField || meta?.displayField || "";
  const value = resolveCardValue(row, field, meta);
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

/** Read a card field, preferring the included relation object for FKs. */
function resolveCardValue(
  row: WorkspaceRecord,
  field: string,
  meta: EntityMeta | null,
): unknown {
  const fieldMeta = fieldMetaForColumn(meta, field);
  if (fieldMeta?.reference) {
    return relationValueFor(row, fieldMeta.name, fieldMeta.reference);
  }
  return getPath(row, field);
}

function CardField({
  row,
  field,
  currency,
  meta,
}: {
  row: WorkspaceRecord;
  field: string;
  currency?: boolean;
  meta: EntityMeta | null;
}) {
  const value = resolveCardValue(row, field, meta);
  if (value === null || value === undefined || value === "") return null;

  return (
    <span className="text-xs text-muted-foreground">
      {formatCellText(value, { columnType: currency ? "currency" : undefined })}
    </span>
  );
}

export function KanbanRenderer({ definition }: ModuleRendererProps) {
  const { can, entityMeta } = useModuleContext();
  const config = definition.config as KanbanConfig;
  const { deptKey, moduleKey } = moduleLocation(definition);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");

  const columns = useMemo(
    () => config.columns ?? [],
    [config.columns],
  );

  const records = useWorkspaceRecords(deptKey, moduleKey, {
    page: 1,
    pageSize: 100,
  });

  const { transition, create, update } = useWorkspaceRecordMutations(
    deptKey,
    moduleKey,
    config.statusField,
  );

  const fields = useMemo(() => formFieldsFromMeta(entityMeta), [entityMeta]);
  const canMove = can("EDIT") && config.allowMove;
  const canCreate = can("CREATE") && config.allowCreate;
  const readOnly = entityMeta?.readOnly === true;

  // Touch devices move cards through the deliberate "Move" sheet; HTML5 drag
  // remains for fine pointers (mouse, trackpad, stylus).
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const dragEnabled = canMove && !isCoarsePointer;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceRecord | null>(null);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkspaceRecord | null>(null);
  const [moveSheet, setMoveSheet] = useState<WorkspaceRecord | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const handledOpenRef = useRef<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOpened = useRef(false);

  const rows = useMemo(() => records.data?.data ?? [], [records.data]);
  const meta = records.data?.meta;

  // `?open=<id>` deep-links straight to the record drawer. The record is
  // fetched directly so the link still works when the card is outside the
  // first page of the board.
  useEffect(() => {
    if (!openId || handledOpenRef.current === openId) return;
    handledOpenRef.current = openId;
    let cancelled = false;

    WorkspaceService.getRecord(deptKey, moduleKey, openId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Record not found or unavailable.");
        router.replace(pathname);
      });

    return () => {
      cancelled = true;
    };
  }, [openId, deptKey, moduleKey, router, pathname]);

  const closeDetail = () => {
    setDetail(null);
    if (openId) {
      handledOpenRef.current = null;
      router.replace(pathname);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceRecord[]>();
    for (const column of columns) map.set(column.value, []);
    for (const row of rows) {
      const status = String(getPath(row, config.statusField) ?? "");
      const bucket = map.get(status);
      if (bucket) bucket.push(row);
      else map.set(status, [...(map.get(status) ?? []), row]);
    }
    return map;
  }, [columns, rows, config.statusField]);

  const openCreate = (status: string | null) => {
    setEditing(null);
    setCreateStatus(status);
    setDialogOpen(true);
  };

  const openEdit = (row: WorkspaceRecord) => {
    setEditing(row);
    setCreateStatus(null);
    setDialogOpen(true);
  };

  const move = (row: WorkspaceRecord, status: string) => {
    const current = String(getPath(row, config.statusField) ?? "");
    if (current === status) return;
    if (!canMove) return;

    const title = cardTitle(row, config, definition.name, entityMeta);
    const label =
      columns.find((column) => column.value === status)?.label ?? status;

    transition.mutate(
      { id: row.id, status },
      {
        onSuccess: () => {
          toast.success(`Moved “${title}” to ${label}.`);
          setAnnouncement(`${title} moved to ${label}.`);
        },
        onError: (error) => {
          setAnnouncement(`Could not move ${title}. ${error.message}`);
          toast.error(error.message);
        },
      },
    );
  };

  const openMoveSheet = (row: WorkspaceRecord) => {
    setMoveSheet(row);
  };

  const closeMoveSheet = () => {
    setMoveSheet(null);
    longPressOpened.current = false;
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (row: WorkspaceRecord) => {
    if (!canMove || !isCoarsePointer) return;
    longPressOpened.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressOpened.current = true;
      openMoveSheet(row);
    }, 500);
  };

  useEffect(() => {
    if (!moveSheet) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoveSheet(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSheet]);

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );

  const onDragStart = (event: DragEvent<HTMLElement>, row: WorkspaceRecord) => {
    if (!dragEnabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", row.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(row.id);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDragOver(null);
  };

  const onDrop = (event: DragEvent<HTMLElement>, column: KanbanColumnConfig) => {
    event.preventDefault();
    setDragOver(null);
    setDraggingId(null);

    const id = event.dataTransfer.getData("text/plain");
    const row = rows.find((entry) => entry.id === id);
    if (row) move(row, column.value);
  };

  const moveByOffset = (row: WorkspaceRecord, offset: number) => {
    const current = String(getPath(row, config.statusField) ?? "");
    const index = columns.findIndex((column) => column.value === current);
    const next = columns[index + offset];
    if (next) move(row, next.value);
  };

  const initialValues = useMemo(() => {
    if (editing) return initialFormValues(fields, editing);
    const values = initialFormValues(fields);
    if (createStatus) values[config.statusField] = createStatus;
    return values;
  }, [editing, fields, createStatus, config.statusField]);

  const submitForm = (values: Record<string, unknown>) => {
    const onSuccess = () => {
      toast.success(editing ? "Card updated." : "Card created.");
      setDialogOpen(false);
      setEditing(null);
      setCreateStatus(null);
    };
    const onError = (error: Error) => toast.error(error.message);

    if (editing) {
      update.mutate({ id: editing.id, body: values }, { onSuccess, onError });
      return;
    }

    create.mutate(values, { onSuccess, onError });
  };

  if (records.isError) {
    return (
      <ErrorState
        title="Could not load the board"
        message={records.error.message}
        onRetry={() => void records.refetch()}
      />
    );
  }

  const renderCard = (row: WorkspaceRecord) => {
    const title = cardTitle(row, config, definition.name, entityMeta);
    const value = config.valueField
      ? resolveCardValue(row, config.valueField, entityMeta)
      : null;
    const assignee = config.assigneeField
      ? resolveCardValue(row, config.assigneeField, entityMeta)
      : null;
    const due = config.dueField
      ? resolveCardValue(row, config.dueField, entityMeta)
      : null;
    const secondaryFields =
      (config.secondaryColumns ?? []).length > 0
        ? (config.secondaryColumns ?? []).map((column) => column.value)
        : (entityMeta?.secondaryDisplayFields ?? []);

    return (
      <article
        key={row.id}
        draggable={dragEnabled}
        onDragStart={(event) => onDragStart(event, row)}
        onDragEnd={onDragEnd}
        onTouchStart={() => startLongPress(row)}
        onTouchMove={cancelLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        role="button"
        tabIndex={0}
        aria-label={`Open ${title}`}
        onKeyDown={(event) => {
          if (canMove && (event.key === "m" || event.key === "M")) {
            event.preventDefault();
            openMoveSheet(row);
            return;
          }
          if (
            canMove &&
            (event.ctrlKey || event.metaKey) &&
            (event.key === "ArrowLeft" || event.key === "ArrowRight")
          ) {
            event.preventDefault();
            moveByOffset(row, event.key === "ArrowLeft" ? -1 : 1);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setDetail(row);
          }
        }}
        onClick={(event) => {
          if (longPressOpened.current) {
            event.preventDefault();
            longPressOpened.current = false;
            return;
          }
          setDetail(row);
        }}
        aria-roledescription={dragEnabled ? "draggable card" : undefined}
        className={cn(
          "flex flex-col gap-2 rounded-md border border-border bg-background p-3 shadow-xs transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none",
          dragEnabled && "cursor-grab active:cursor-grabbing",
          draggingId === row.id && "opacity-50",
        )}
      >
        <div className="flex items-start gap-1">
          {dragEnabled ? (
            <GripVertical
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
          <h3 className="flex-1 text-sm font-medium leading-5">{title}</h3>
          {can("EDIT") && !readOnly ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={`Edit ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(row);
              }}
            >
              <Pencil aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {value !== null && value !== undefined && value !== "" ? (
          <span className="text-sm font-semibold tabular-nums">
            {formatCellText(value, {
              columnType: fieldMetaForColumn(
                entityMeta,
                config.valueField ?? "",
              )?.type,
            })}
          </span>
        ) : null}

        {secondaryFields.map((field) => (
          <CardField
            key={field}
            row={row}
            field={field}
            meta={entityMeta}
            currency={fieldMetaForColumn(entityMeta, field)?.type === "currency"}
          />
        ))}

        {assignee !== null && assignee !== undefined && assignee !== "" ? (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span className="sr-only">Assignee</span>
            <CellValue
              value={assignee}
              field={fieldMetaForColumn(
                entityMeta,
                config.assigneeField ?? "",
              )}
            />
          </div>
        ) : null}

        {due !== null && due !== undefined && due !== "" ? (
          <CardField
            row={row}
            field={config.dueField as string}
            meta={entityMeta}
          />
        ) : null}

        {canMove ? (
          isCoarsePointer ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 min-h-11 w-full justify-center"
              aria-label={`Move ${title} to another column`}
              onClick={(event) => {
                event.stopPropagation();
                openMoveSheet(row);
              }}
            >
              <ArrowLeftRight className="mr-1 size-4" aria-hidden="true" />
              Move
            </Button>
          ) : (
            <label
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span className="sr-only">Move {title} to</span>
              <Select
                className="h-7 py-0 text-xs"
                aria-label={`Move ${title} to another column`}
                value={String(getPath(row, config.statusField) ?? "")}
                onChange={(event) => move(row, event.target.value)}
              >
                {columns.map((column) => (
                  <option key={column.value} value={column.value}>
                    {column.label}
                  </option>
                ))}
              </Select>
            </label>
          )
        ) : null}
      </article>
    );
  };

  return (
    <section className="flex flex-col gap-4" aria-label={definition.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{rows.length} cards</Badge>
          {meta ? <span>{meta.total} total</span> : null}
          {canMove ? (
            <span>
              {isCoarsePointer
                ? "Tap Move on a card to change its column."
                : "Drag a card, press M, or use Ctrl/Cmd + ← / → to move it."}
            </span>
          ) : null}
        </div>
        {canCreate && !readOnly ? (
          <Button size="sm" onClick={() => openCreate(null)}>
            <Plus aria-hidden="true" />
            New card
          </Button>
        ) : null}
      </div>

      {records.isPending ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading board"
        >
          {columns.map((column) => (
            <div
              key={column.value}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="relative flex gap-3 overflow-x-auto pb-2">
          {/* `relative` keeps the absolutely positioned `sr-only` labels in the
              cards clipped by this scroll container instead of escaping to the
              document and widening the page on mobile. */}
          {columns.map((column) => {
            const cards = grouped.get(column.value) ?? [];
            return (
              <div
                key={column.value}
                onDragOver={(event) => {
                  if (!dragEnabled) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOver(column.value);
                }}
                onDragLeave={() =>
                  setDragOver((current) =>
                    current === column.value ? null : current,
                  )
                }
                onDrop={(event) => onDrop(event, column)}
                aria-label={`${column.label} column`}
                className={cn(
                  "flex min-w-64 flex-1 flex-col gap-3 rounded-lg border border-t-4 border-border bg-card p-3",
                  columnTone(column.color),
                  dragOver === column.value && "bg-muted/60 ring-2 ring-ring/40",
                )}
              >
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{column.label}</h2>
                  <Badge variant="outline">{cards.length}</Badge>
                </header>

                <div className="flex flex-col gap-2">
                  {cards.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      Drop a card here.
                    </p>
                  ) : (
                    cards.map(renderCard)
                  )}
                </div>

                {canCreate && !readOnly ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-muted-foreground"
                    onClick={() => openCreate(column.value)}
                  >
                    <Plus aria-hidden="true" />
                    Add card
                  </Button>
                ) : null}
              </div>
            );
          })}

          {columns.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              This board has no columns configured.
            </p>
          ) : null}
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <p className="text-xs text-muted-foreground">
          Showing the first {meta.pageSize} of {meta.total} records.
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {moveSheet ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={closeMoveSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kanban-move-title"
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-card p-4 shadow-lg sm:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="kanban-move-title" className="text-sm font-semibold">
              Move “
              {cardTitle(moveSheet, config, definition.name, entityMeta)}” to
            </h2>
            <div
              role="radiogroup"
              aria-label="Select a column"
              className="mt-3 flex flex-col gap-1"
            >
              {columns.map((column) => {
                const checked =
                  String(getPath(moveSheet, config.statusField) ?? "") ===
                  column.value;
                return (
                  <button
                    key={column.value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    autoFocus={checked}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-left text-sm transition-colors",
                      checked
                        ? "bg-accent font-medium text-accent-foreground"
                        : "hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
                    )}
                    onClick={() => {
                      move(moveSheet, column.value);
                      closeMoveSheet();
                    }}
                  >
                    <span>{column.label}</span>
                    {checked ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={closeMoveSheet}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RecordDrawer
        open={Boolean(detail)}
        onClose={closeDetail}
        title={
          detail
            ? cardTitle(detail, config, definition.name, entityMeta)
            : definition.name
        }
        record={detail}
        meta={entityMeta}
        deptKey={deptKey}
        moduleKey={moduleKey}
        canReassign={can("EDIT") && entityMeta?.reassignable === true}
        attachmentsEnabled={definition.features?.attachments === true}
      />

      <RecordFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          setCreateStatus(null);
        }}
        title={editing ? "Edit card" : "New card"}
        description={definition.name}
        fields={fields}
        initialValues={initialValues}
        submitLabel={editing ? "Save changes" : "Create card"}
        busy={create.isPending || update.isPending}
        error={
          (create.error as Error | null)?.message ??
          (update.error as Error | null)?.message ??
          null
        }
        onSubmit={submitForm}
      />
    </section>
  );
}
