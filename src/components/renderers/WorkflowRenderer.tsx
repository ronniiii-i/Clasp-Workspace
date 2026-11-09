"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  leaveErrorMessage,
  useLeaveTimeline,
  useLeaveWorkflow,
} from "@/hooks/workspace/useLeaveWorkflow";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate, formatEnum, formatRelative } from "@/lib/format";
import { moduleLocation } from "@/lib/workspace-navigation";
import { useModuleContext } from "./ModuleContext";
import type { ModuleRendererProps } from "./types";
import type { AuthUser } from "@/lib/modules";
import type {
  LeaveAction,
  LeaveCreateInput,
  LeaveRequestRecord,
  LeaveStatus,
  LeaveType,
  LeaveUserSummary,
  WorkflowConfig,
} from "@/lib/workspace-types";

const LEAVE_TYPES: LeaveType[] = [
  "ANNUAL",
  "SICK",
  "CASUAL",
  "UNPAID",
  "PARENTAL",
  "OTHER",
];

const STATUS_LABELS: Record<
  LeaveStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING_TEAM_LEAD: { label: "Team Lead review", variant: "secondary" },
  PENDING_HR: { label: "HR review", variant: "secondary" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

const ACTION_LABELS: Record<LeaveAction, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  CANCEL: "Cancelled",
};

type TabKey = "mine" | "approvals" | "all";

interface LeaveFormState {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

interface ActionState {
  kind: LeaveAction;
  record: LeaveRequestRecord;
}

const EMPTY_FORM: LeaveFormState = {
  type: "ANNUAL",
  startDate: "",
  endDate: "",
  reason: "",
};

function startOfUtcDay(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** Mirrors the backend working-day rule (Mon-Fri inclusive, UTC midnights). */
export function workingDaysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const from = startOfUtcDay(start);
  const to = startOfUtcDay(end);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;

  let count = 0;
  for (let time = from; time <= to; time += 24 * 60 * 60 * 1000) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function isPastDate(value: string): boolean {
  const parsed = startOfUtcDay(value);
  if (Number.isNaN(parsed)) return false;
  const today = new Date();
  const utcToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return parsed < utcToday;
}

/** Date-only values must not shift with the browser timezone. */
function formatLeaveDate(value?: string | null): string {
  if (!value) return "—";
  return formatDate(value.slice(0, 10));
}

function isPendingStatus(status: LeaveStatus): boolean {
  return status === "PENDING_TEAM_LEAD" || status === "PENDING_HR";
}

function isTenantAdmin(user: AuthUser | null): boolean {
  const role = user?.role;
  if (!role) return false;
  if (typeof role === "string") return role.toLowerCase() === "tenant_admin";
  return Boolean(role.isTenantAdmin) || role.slug === "tenant_admin";
}

/** True when this actor is the designated approver at the current stage. */
function isCurrentApprover(
  row: LeaveRequestRecord,
  userId: string | undefined,
  admin: boolean,
): boolean {
  if (!userId || !isPendingStatus(row.status)) return false;
  if (admin) return true;
  if (row.userId === userId) return false;
  if (row.status === "PENDING_TEAM_LEAD") {
    return row.teamLeadId === userId || row.hodId === userId;
  }
  return row.hrApproverId === userId;
}

function canCancel(row: LeaveRequestRecord, userId: string | undefined): boolean {
  return Boolean(userId) && isPendingStatus(row.status) && row.userId === userId;
}

function approverFor(row: LeaveRequestRecord): LeaveUserSummary | null {
  if (row.status === "PENDING_TEAM_LEAD") {
    return row.teamLead ?? row.hod ?? null;
  }
  if (row.status === "PENDING_HR") return row.hrApprover ?? null;
  return row.decidedBy ?? null;
}

function statusMeta(status: LeaveStatus) {
  return STATUS_LABELS[status] ?? { label: formatEnum(status), variant: "outline" as const };
}

function averageDecisionHours(rows: LeaveRequestRecord[]): number | null {
  const durations = rows
    .filter((row) => row.decidedAt && (row.submittedAt || row.createdAt))
    .map((row) => {
      const from = new Date(row.submittedAt ?? row.createdAt ?? "").getTime();
      const to = new Date(row.decidedAt as string).getTime();
      return to - from;
    })
    .filter((duration) => Number.isFinite(duration) && duration >= 0);

  if (durations.length === 0) return null;
  return (
    durations.reduce((total, duration) => total + duration, 0) / durations.length
  );
}

function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold leading-tight">{value}</span>
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const meta = statusMeta(status);
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function TimelineList({
  entries,
  loading,
  error,
}: {
  entries: Array<{
    id: string;
    action: string;
    actorName: string;
    at: string;
    note: string | null;
    status: string | null;
    override: boolean;
  }>;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {entry.action === "REJECT" || entry.action === "CANCEL" ? (
              <XCircle className="size-3.5" aria-hidden="true" />
            ) : entry.action === "APPROVE" ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <Clock className="size-3.5" aria-hidden="true" />
            )}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {formatEnum(entry.action)}{" "}
              <span className="font-normal text-muted-foreground">
                by {entry.actorName}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelative(entry.at)}
              {entry.override ? " · admin override" : ""}
            </span>
            {entry.note ? (
              <span className="text-sm text-muted-foreground">{entry.note}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WorkflowRenderer({ definition }: ModuleRendererProps) {
  const { can, dataScope } = useModuleContext();
  const config = definition.config as WorkflowConfig;
  const { deptKey, moduleKey } = moduleLocation(definition);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { records, create, transition, rows } = useLeaveWorkflow(
    deptKey,
    moduleKey,
  );

  const [tab, setTab] = useState<TabKey>("mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<LeaveFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeaveRequestRecord | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const handledOpenRef = useRef<string | null>(null);

  const userId = user?.id;
  const admin = isTenantAdmin(user ?? null);
  const canApprove = can("EDIT") || can("CREATE");
  const canCreate =
    (config.allowCreate ?? true) && (can("CREATE") || can("EDIT"));

  const openId = searchParams.get("open");
  const timeline = useLeaveTimeline(
    deptKey,
    moduleKey,
    detail?.id ?? null,
  );

  const visibleRows = useMemo(() => {
    if (tab === "mine") return rows.filter((row) => row.userId === userId);
    if (tab === "approvals") {
      return rows.filter((row) =>
        isCurrentApprover(row, userId, admin),
      );
    }
    return rows;
  }, [rows, tab, userId, admin]);

  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
    );
    const decidedThisMonth = (status: LeaveStatus) =>
      rows.filter(
        (row) =>
          row.status === status &&
          row.decidedAt &&
          new Date(row.decidedAt).getTime() >= monthStart,
      ).length;

    return {
      pending: rows.filter((row) => isPendingStatus(row.status)).length,
      approved: decidedThisMonth("APPROVED"),
      rejected: decidedThisMonth("REJECTED"),
      average: formatDuration(averageDecisionHours(rows)),
    };
  }, [rows]);

  // Keep the open detail in sync with refreshed list data.
  useEffect(() => {
    if (!detail) return;
    const fresh = rows.find((row) => row.id === detail.id);
    if (fresh && fresh !== detail) setDetail(fresh);
  }, [rows, detail]);

  // Deep links: /module?open=<id> opens the detail modal.
  useEffect(() => {
    if (!openId || handledOpenRef.current === openId) return;
    if (records.isPending) return;

    const match = rows.find((row) => row.id === openId);
    if (match) {
      handledOpenRef.current = openId;
      setDetail(match);
      return;
    }

    handledOpenRef.current = openId;
    toast.error("Record not found or unavailable.");
    router.replace(pathname);
  }, [openId, rows, records.isPending, router, pathname]);

  const closeDetail = () => {
    setDetail(null);
    if (openId) {
      handledOpenRef.current = null;
      router.replace(pathname);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  };

  const previewDays = workingDaysBetween(form.startDate, form.endDate);

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!form.startDate || !form.endDate) {
      setFormError("Select both a start and an end date.");
      return;
    }
    if (previewDays === 0) {
      setFormError("The selected range does not include a working day.");
      return;
    }
    if (isPastDate(form.startDate)) {
      setFormError("Leave requests cannot start in the past.");
      return;
    }
    if (!form.reason.trim()) {
      setFormError("Enter a reason for your leave.");
      return;
    }

    const input: LeaveCreateInput = {
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason.trim(),
    };

    create.mutate(input, {
      onSuccess: () => {
        toast.success("Leave request submitted.");
        setAnnouncement("Leave request submitted and sent for approval.");
        setCreateOpen(false);
        setForm(EMPTY_FORM);
      },
      onError: (error) => setFormError(leaveErrorMessage(error)),
    });
  };

  const startAction = (kind: LeaveAction, record: LeaveRequestRecord) => {
    closeDetail();
    setAction({ kind, record });
    setNote("");
    setActionError(null);
  };

  const confirmAction = () => {
    if (!action) return;
    if (action.kind === "REJECT" && !note.trim()) {
      setActionError("A note is required when rejecting a request.");
      return;
    }

    transition.mutate(
      {
        id: action.record.id,
        input: {
          action: action.kind,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (updated) => {
          const message = `${ACTION_LABELS[action.kind]} leave request for ${
            action.record.user?.name ?? "the requester"
          }.`;
          toast.success(message);
          setAnnouncement(message);
          setAction(null);
          setNote("");
          if (detail?.id === updated.id) setDetail(updated);
        },
        onError: (error) => setActionError(leaveErrorMessage(error)),
      },
    );
  };

  if (records.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
        <p className="font-medium">Could not load leave requests</p>
        <p className="text-sm text-muted-foreground">
          {records.error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => void records.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const isInitialLoading = records.isPending && rows.length === 0;
  const canSeeAll = dataScope === "DEPARTMENT" || dataScope === "TENANT";
  const activeTab = !canSeeAll && tab === "all" ? "mine" : tab;

  return (
    <section className="flex flex-col gap-4" aria-label={definition.name}>
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="leave-announcement"
      >
        {announcement}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pending"
          value={summary.pending}
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <SummaryCard
          label="Approved this month"
          value={summary.approved}
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
        />
        <SummaryCard
          label="Rejected this month"
          value={summary.rejected}
          icon={<XCircle className="size-4" aria-hidden="true" />}
        />
        <SummaryCard
          label="Avg. decision time"
          value={summary.average}
          icon={<CalendarDays className="size-4" aria-hidden="true" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setTab(value as TabKey)}
        >
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="mine">My requests</TabsTrigger>
            <TabsTrigger value="approvals">Awaiting my approval</TabsTrigger>
            {canSeeAll ? <TabsTrigger value="all">All</TabsTrigger> : null}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {visibleRows.length} request{visibleRows.length === 1 ? "" : "s"}
          </span>
          {canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden="true" />
              New request
            </Button>
          ) : null}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requester</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Age</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: 8 }).map((__, cell) => (
                    <TableCell key={`cell-${cell}`}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage(activeTab)}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.user?.name ?? "—"}
                  </TableCell>
                  <TableCell>{formatEnum(row.type)}</TableCell>
                  <TableCell>
                    {formatLeaveDate(row.startDate)} –{" "}
                    {formatLeaveDate(row.endDate)}
                  </TableCell>
                  <TableCell>{row.days}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{approverFor(row)?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(row.submittedAt ?? row.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View leave request for ${
                        row.user?.name ?? "requester"
                      }`}
                      onClick={() => setDetail(row)}
                    >
                      <Eye aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {isInitialLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`card-skeleton-${index}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-4 w-48" />
            </div>
          ))
        ) : visibleRows.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage(activeTab)}
          </p>
        ) : (
          visibleRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setDetail(row)}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {row.user?.name ?? "Requester"}
                </span>
                <StatusBadge status={row.status} />
              </span>
              <span className="text-sm text-muted-foreground">
                {formatEnum(row.type)} · {formatLeaveDate(row.startDate)} –{" "}
                {formatLeaveDate(row.endDate)} · {row.days} day
                {row.days === 1 ? "" : "s"}
              </span>
              <span className="text-xs text-muted-foreground">
                Approver: {approverFor(row)?.name ?? "—"} ·{" "}
                {formatRelative(row.submittedAt ?? row.createdAt)}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Create request */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Request leave"
        description="Your request goes to your Team Lead or HOD, then HR."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="leave-request-form" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </>
        }
      >
        <form
          id="leave-request-form"
          className="flex flex-col gap-4"
          onSubmit={submitCreate}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select
              id="leave-type"
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as LeaveType,
                }))
              }
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatEnum(type)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-start">Start date</Label>
              <Input
                id="leave-start"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-end">End date</Label>
              <Input
                id="leave-end"
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Working days:{" "}
            <span className="font-medium text-foreground">{previewDays}</span>
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-reason">Reason</Label>
            <Textarea
              id="leave-reason"
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              maxLength={2000}
              required
            />
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={closeDetail}
        title={
          detail ? `${formatEnum(detail.type)} leave request` : "Leave request"
        }
        description={
          detail
            ? `${formatLeaveDate(detail.startDate)} – ${formatLeaveDate(
                detail.endDate,
              )} · ${detail.days} working day${detail.days === 1 ? "" : "s"}`
            : undefined
        }
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={closeDetail}>
                Close
              </Button>
              {canApprove && canCancel(detail, userId) ? (
                <Button
                  variant="outline"
                  onClick={() => startAction("CANCEL", detail)}
                >
                  Cancel request
                </Button>
              ) : null}
              {canApprove && isCurrentApprover(detail, userId, admin) ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => startAction("REJECT", detail)}
                  >
                    <X aria-hidden="true" />
                    Reject
                  </Button>
                  <Button onClick={() => startAction("APPROVE", detail)}>
                    <Check aria-hidden="true" />
                    Approve
                  </Button>
                </>
              ) : null}
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Requester" value={detail.user?.name ?? "—"} />
              <Detail label="Status">
                <StatusBadge status={detail.status} />
              </Detail>
              <Detail
                label="Current approver"
                value={approverFor(detail)?.name ?? "—"}
              />
              <Detail
                label="Decision note"
                value={detail.decisionNote ?? "—"}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reason
              </span>
              <p className="whitespace-pre-wrap text-sm">{detail.reason}</p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Timeline
              </span>
              <TimelineList
                entries={timeline.data?.timeline ?? []}
                loading={timeline.isPending}
                error={
                  timeline.isError ? timeline.error.message : null
                }
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Approve / reject / cancel confirmation */}
      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={
          action
            ? `${formatEnum(action.kind)} leave request`
            : "Leave request"
        }
        description={
          action?.record.user?.name
            ? `${action.record.user.name} · ${formatLeaveDate(
                action.record.startDate,
              )} – ${formatLeaveDate(action.record.endDate)}`
            : undefined
        }
        footer={
          action ? (
            <>
              <Button
                variant="outline"
                onClick={() => setAction(null)}
                disabled={transition.isPending}
              >
                Back
              </Button>
              <Button
                variant={action.kind === "REJECT" ? "destructive" : "default"}
                onClick={confirmAction}
                disabled={
                  transition.isPending ||
                  (action.kind === "REJECT" && !note.trim())
                }
              >
                {transition.isPending
                  ? "Saving…"
                  : formatEnum(action.kind)}
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-note">
            Note {action?.kind === "REJECT" ? "(required)" : "(optional)"}
          </Label>
          <Textarea
            id="leave-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
          />
          {action?.kind === "REJECT" && !note.trim() ? (
            <p className="text-xs text-muted-foreground">
              Explain why this request is being rejected.
            </p>
          ) : null}
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}

function Detail({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children ?? <span>{value ?? "—"}</span>}
    </div>
  );
}

function emptyMessage(tab: TabKey): string {
  if (tab === "mine") return "You have not submitted any leave requests yet.";
  if (tab === "approvals") return "No leave requests are awaiting your approval.";
  return "No leave requests match this view.";
}
