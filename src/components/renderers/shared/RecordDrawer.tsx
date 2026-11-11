"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  AssigneeUser,
  EntityMeta,
  WorkspaceRecord,
} from "@/lib/workspace-types";
import { WorkspaceService } from "@/services/workspace";
import { AttachmentsSection } from "./AttachmentsSection";
import { CellValue } from "./CellValue";
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
  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [saving, setSaving] = useState(false);

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
      field.name !== "customFields",
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

  const openReassign = async () => {
    if (!record || !deptKey || !moduleKey) return;
    setReassignOpen(true);
    setLoadingAssignees(true);
    setAssigneeId("");
    try {
      const response = await WorkspaceService.listAssignees(deptKey, moduleKey);
      setAssignees(response.users ?? []);
    } catch (error) {
      setAssignees([]);
      toast.error(
        error instanceof Error ? error.message : "Failed to load assignees",
      );
    } finally {
      setLoadingAssignees(false);
    }
  };

  const submitReassign = async () => {
    if (!record || !deptKey || !moduleKey || !assigneeId) return;
    setSaving(true);
    try {
      const updated = await WorkspaceService.reassignRecord(
        deptKey,
        moduleKey,
        String(record.id),
        assigneeId,
      );
      onReassigned?.(updated);
      setReassignOpen(false);
      toast.success("Record reassigned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reassign record",
      );
    } finally {
      setSaving(false);
    }
  };

  const candidates = assignees.filter((user) => user.id !== currentOwnerId);

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
              <Button variant="outline" onClick={openReassign}>
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

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign record"
        description="Only active teammates who can view this module are listed."
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReassign}
              disabled={!assigneeId || saving || loadingAssignees}
            >
              {saving ? "Reassigning…" : "Reassign"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="reassign-assignee">New assignee</Label>
          <Select
            id="reassign-assignee"
            value={assigneeId}
            disabled={loadingAssignees}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">
              {loadingAssignees ? "Loading…" : "Select a teammate"}
            </option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          {!loadingAssignees && candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No eligible teammates are available for this record.
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
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
