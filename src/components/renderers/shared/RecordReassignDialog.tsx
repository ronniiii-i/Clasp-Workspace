"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { AssigneeUser, WorkspaceRecord } from "@/lib/workspace-types";
import { WorkspaceService } from "@/services/workspace";

interface RecordReassignDialogProps {
  open: boolean;
  deptKey: string;
  moduleKey: string;
  recordId: string | null;
  recordTitle?: string;
  currentAssigneeId?: string | null;
  onClose: () => void;
  onReassigned?: (record: WorkspaceRecord) => void;
}

/**
 * Shared reassignment modal used by the record drawer and dashboard cards.
 *
 * The candidate list comes from `GET .../records/assignees`, which already
 * enforces the caller's scope, active-user and module-access rules.
 */
export function RecordReassignDialog({
  open,
  deptKey,
  moduleKey,
  recordId,
  recordTitle,
  currentAssigneeId,
  onClose,
  onReassigned,
}: RecordReassignDialogProps) {
  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!deptKey || !moduleKey) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [deptKey, moduleKey]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const submit = async () => {
    if (!recordId || !assigneeId) return;
    setSaving(true);
    try {
      const updated = await WorkspaceService.reassignRecord(
        deptKey,
        moduleKey,
        recordId,
        assigneeId,
      );
      onReassigned?.(updated);
      toast.success("Record reassigned");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reassign record",
      );
    } finally {
      setSaving(false);
    }
  };

  const candidates = assignees.filter((user) => user.id !== currentAssigneeId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reassign record"
      description={
        recordTitle
          ? `Choose a new owner for ${recordTitle}.`
          : "Only active teammates who can view this module are listed."
      }
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!assigneeId || saving || loading}>
            {saving ? "Reassigning." : "Reassign"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="dashboard-reassign-assignee">New assignee</Label>
        <Select
          id="dashboard-reassign-assignee"
          value={assigneeId}
          disabled={loading}
          onChange={(event) => setAssigneeId(event.target.value)}
        >
          <option value="">
            {loading ? "Loading." : "Select a teammate"}
          </option>
          {candidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
        {!loading && candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No eligible teammates are available for this record.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
