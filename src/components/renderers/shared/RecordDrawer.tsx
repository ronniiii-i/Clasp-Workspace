"use client";

import { useState } from "react";
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
import { CellValue } from "./CellValue";
import { formatTimestamp, getPath } from "./record-utils";

/**
 * Read-only record drawer.
 *
 * Shows every allowlisted entity field plus any `customFields` entries stored
 * on the row. Custom fields are authored through the Form renderer and are not
 * first-class columns, so they are rendered separately.
 *
 * When the entity is reassignable and the caller can edit it, the drawer also
 * exposes a reassignment modal backed by the scoped assignee endpoint.
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
  onReassigned?: (record: WorkspaceRecord) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [saving, setSaving] = useState(false);

  const fields = meta?.fields.filter((field) => !field.relation) ?? [];
  const customFields =
    record?.customFields &&
    typeof record.customFields === "object" &&
    !Array.isArray(record.customFields)
      ? (record.customFields as Record<string, unknown>)
      : {};

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
        description={
          record ? `Record ${String(record.id).slice(0, 8)}` : undefined
        }
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
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.name} className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="text-sm">
                    <CellValue
                      value={getPath(record, field.name)}
                      field={field}
                    />
                  </dd>
                </div>
              ))}
            </dl>

            {Object.keys(customFields).length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Custom fields</h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {Object.entries(customFields).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {key}
                      </dt>
                      <dd className="text-sm">
                        <CellValue value={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Created {formatTimestamp(record.createdAt)}</span>
              <span>Updated {formatTimestamp(record.updatedAt)}</span>
            </div>
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
