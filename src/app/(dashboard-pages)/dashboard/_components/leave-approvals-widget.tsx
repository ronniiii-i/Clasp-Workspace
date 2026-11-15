"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  leaveErrorMessage,
  useLeaveWorkflow,
} from "@/hooks/workspace/useLeaveWorkflow";
import { formatDate } from "@/lib/format";
import { moduleLocation } from "@/lib/workspace-navigation";
import type { LeaveRequestRecord } from "@/lib/workspace-types";

type DecisionAction = "APPROVE" | "REJECT";

interface PendingDecision {
  request: LeaveRequestRecord;
  action: DecisionAction;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function isAwaitingDecision(
  request: LeaveRequestRecord,
  userId: string,
): boolean {
  if (request.status === "PENDING_TEAM_LEAD") {
    return request.teamLeadId === userId;
  }
  if (request.status === "PENDING_HR") {
    return request.hodId === userId || request.hrApproverId === userId;
  }
  return false;
}

/**
 * "Awaiting my approval" card for team leads, HODs and HR approvers.
 *
 * It reuses the leave workflow hook so transitions share the same optimistic
 * cache patch, 409 handling and invalidation as the workflow renderer. The
 * widget renders nothing when the caller has no pending decisions.
 */
export function LeaveApprovalsWidget() {
  const { user } = useAuth();
  const { modules } = usePermissions();
  const leaveModule = useMemo(
    () => modules.find((module) => module.targetEntity === "leave_requests"),
    [modules],
  );
  const { deptKey, moduleKey } = leaveModule
    ? moduleLocation({
        key: leaveModule.key ?? "",
        path: leaveModule.path,
        department:
          typeof leaveModule.department === "object"
            ? leaveModule.department
            : undefined,
      })
    : { deptKey: "", moduleKey: "" };

  const workflow = useLeaveWorkflow(deptKey, moduleKey);
  const [decision, setDecision] = useState<PendingDecision | null>(null);
  const [note, setNote] = useState("");

  const pending = useMemo(() => {
    if (!user?.id) return [];
    return workflow.rows.filter((request) =>
      isAwaitingDecision(request, user.id),
    );
  }, [user?.id, workflow.rows]);

  if (!leaveModule || pending.length === 0) return null;

  const close = () => {
    setDecision(null);
    setNote("");
  };

  const submit = async () => {
    if (!decision) return;
    try {
      await workflow.transition.mutateAsync({
        id: decision.request.id,
        input: {
          action: decision.action,
          note: note.trim() || undefined,
        },
      });
      toast.success(
        decision.action === "APPROVE" ? "Leave approved" : "Leave rejected",
      );
      close();
      void workflow.invalidate();
    } catch (error) {
      toast.error(leaveErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5" aria-hidden="true" />
          Awaiting my approval ({pending.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pending.map((request) => {
            const busy =
              workflow.transition.isPending &&
              decision?.request.id === request.id;
            return (
              <div
                key={request.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {request.user?.name ?? "Teammate"}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {titleCase(request.type)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {request.status === "PENDING_TEAM_LEAD"
                        ? "Team lead review"
                        : "HR review"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(request.startDate)} →{" "}
                    {formatDate(request.endDate)} • {request.days} day
                    {request.days === 1 ? "" : "s"}
                  </p>
                  {request.reason ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {request.reason}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 min-w-11"
                    disabled={busy}
                    onClick={() => {
                      setDecision({ request, action: "REJECT" });
                      setNote("");
                    }}
                  >
                    <X className="mr-1 size-4" aria-hidden="true" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-11 min-w-11"
                    disabled={busy}
                    onClick={() => {
                      setDecision({ request, action: "APPROVE" });
                      setNote("");
                    }}
                  >
                    {busy ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 size-4" aria-hidden="true" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p aria-live="polite" className="sr-only">
          {pending.length} leave request
          {pending.length === 1 ? "" : "s"} awaiting your decision.
        </p>
      </CardContent>

      <Modal
        open={Boolean(decision)}
        onClose={close}
        title={
          decision?.action === "APPROVE" ? "Approve leave" : "Reject leave"
        }
        description={
          decision
            ? `${decision.request.user?.name ?? "This teammate"} • ${formatDate(
                decision.request.startDate,
              )} → ${formatDate(decision.request.endDate)}`
            : undefined
        }
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              variant={decision?.action === "REJECT" ? "destructive" : "default"}
              onClick={() => void submit()}
              disabled={workflow.transition.isPending}
            >
              {workflow.transition.isPending
                ? "Saving."
                : decision?.action === "APPROVE"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-decision-note">Note (optional)</Label>
          <Textarea
            id="leave-decision-note"
            value={note}
            rows={3}
            maxLength={1000}
            placeholder="Add a short note for the requester."
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </Modal>
    </Card>
  );
}
