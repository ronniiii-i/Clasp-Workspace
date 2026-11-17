"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AuditDiff } from "@/components/audit/AuditDiff";
import type { EntityMeta, WorkspaceRecord } from "@/lib/workspace-types";
import { AttachmentsSection } from "./AttachmentsSection";
import { CellValue } from "./CellValue";
import { RecordReassignDialog } from "./RecordReassignDialog";
import {
  customFieldEntries,
  displayName,
  formatTimestamp,
  isHiddenField,
  relationValueFor,
} from "./record-utils";

interface DrawerSectionProps {
  title: string;
  children: ReactNode;
}

function DrawerSection({ title, children }: DrawerSectionProps) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Read-only record drawer.
 *
 * Sections are derived from entity metadata: display fields form the summary,
 * reference fields become linked relations, the remaining writable/readable
 * scalars go to Details, and `customFields` gets its own labelled list.
 */
export function RecordDrawer({
  open,
  onClose,
  title,
  record,
  meta,
  onEdit,
  deptKey,
  moduleKey,
  canReassign = false,
  canEdit = false,
  attachmentsEnabled = false,
  onReassigned,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  record: WorkspaceRecord | null;
  meta: EntityMeta | null;
  onEdit?: () => void;
  deptKey?: string;
  moduleKey?: string;
  canReassign?: boolean;
  canEdit?: boolean;
  attachmentsEnabled?: boolean;
  onReassigned?: (record: WorkspaceRecord) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);

  const isAudit = meta?.key === "audit_logs";

  const fields =
    meta?.fields.filter(
      (field) => !field.relation && !isHiddenField(field.name, field),
    ) ?? [];

  const displayFields = new Set(
    [meta?.displayField, ...(meta?.secondaryDisplayFields ?? [])].filter(
      (name): name is string => Boolean(name),
    ),
  );
  const displayValues = fields.filter((field) =>
    displayFields.has(field.name),
  );
  const relationFields = fields.filter((field) => field.reference);
  const detailFields = fields.filter(
    (field) =>
      !field.reference &&
      !displayFields.has(field.name) &&
      field.name !== "customFields" &&
      // Audit payloads are rendered as a before/after diff below.
      !(isAudit && (field.name === "before" || field.name === "after")),
  );

  const customFields = customFieldEntries(record?.customFields);
  const ownerLabel =
    displayName(record?.assignedTo) ??
    displayName(record?.user) ??
    displayName(record?.createdBy);

  const currentOwnerId =
    typeof record?.userId === "string"
      ? record.userId
      : typeof record?.assignedToId === "string"
        ? record.assignedToId
        : null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        description={meta?.label ?? undefined}
        className="max-w-2xl"
        footer={
          <>
            {canReassign && record ? (
              <Button variant="outline" onClick={() => setReassignOpen(true)}>
                Reassign
              </Button>
            ) : null}
            {onEdit ? (
              <Button variant="outline" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
            <Button onClick={onClose}>Close</Button>
          </>
        }
      >
        {record ? (
          <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
            {displayValues.length > 0 ? (
              <section className="flex flex-col gap-2" aria-label="Summary">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {displayValues.map((field) => (
                    <div key={field.name} className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-sm">
                        <CellValue
                          value={getFieldValue(record, field)}
                          field={field}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {relationFields.length > 0 ? (
              <DrawerSection title="Relations">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {relationFields.map((field) => (
                    <div key={field.name} className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-sm">
                        <CellValue
                          value={relationValueFor(
                            record,
                            field.name,
                            field.reference,
                          )}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </DrawerSection>
            ) : null}

            {detailFields.length > 0 ? (
              <DrawerSection title="Details">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {detailFields.map((field) => (
                    <div key={field.name} className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-sm">
                        <CellValue value={getFieldValue(record, field)} field={field} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </DrawerSection>
            ) : null}

            {isAudit ? (
              <DrawerSection title="Changes">
                <AuditDiff
                  before={asDiffObject(record.before)}
                  after={asDiffObject(record.after)}
                />
              </DrawerSection>
            ) : null}

            {customFields.length > 0 ? (
              <DrawerSection title="Custom fields">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {customFields.map((entry) => (
                    <div key={entry.key} className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {entry.label}
                      </dt>
                      <dd className="text-sm">
                        <CellValue value={entry.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </DrawerSection>
            ) : null}

            {attachmentsEnabled && deptKey && moduleKey ? (
              <AttachmentsSection
                deptKey={deptKey}
                moduleKey={moduleKey}
                recordId={String(record.id)}
                canEdit={canEdit}
              />
            ) : null}

            <DrawerSection title="Activity">
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Created</span>
                  <span className="tabular-nums">
                    {formatTimestamp(record.createdAt)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="tabular-nums">
                    {formatTimestamp(record.updatedAt)}
                  </span>
                </li>
              </ul>
            </DrawerSection>

            <DrawerSection title="Metadata">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Record type</dt>
                  <dd>{meta?.label ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Module</dt>
                  <dd>{moduleKey ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Department</dt>
                  <dd>{deptKey ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd>{ownerLabel ?? "—"}</dd>
                </div>
              </dl>
            </DrawerSection>
          </div>
        ) : null}
      </Modal>

      <RecordReassignDialog
        open={reassignOpen}
        deptKey={deptKey ?? ""}
        moduleKey={moduleKey ?? ""}
        recordId={record ? String(record.id) : null}
        recordTitle={
          record
            ? String(
                record[meta?.displayField ?? "title"] ??
                  record.title ??
                  "",
              )
            : undefined
        }
        currentAssigneeId={currentOwnerId}
        onClose={() => setReassignOpen(false)}
        onReassigned={onReassigned}
      />
    </>
  );
}

/** Audit JSON columns are objects; strings/arrays are not diffable. */
function asDiffObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Reference-aware scalar read for the summary/details sections. */
function getFieldValue(
  record: Record<string, unknown>,
  field: { name: string; reference?: { relationField?: string } },
): unknown {
  if (field.reference) {
    return relationValueFor(record, field.name, field.reference);
  }
  return record[field.name];
}
