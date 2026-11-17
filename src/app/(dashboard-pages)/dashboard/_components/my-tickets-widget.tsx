"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Ticket as TicketIcon,
  UserPlus,
} from "lucide-react";

import { Ticket } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordReassignDialog } from "@/components/renderers/shared/RecordReassignDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useRecordActions } from "@/hooks/useRecordActions";
import { moduleLocation } from "@/lib/workspace-navigation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Ticket["status"], string> = {
  open: "Open",
  pending: "In progress",
  resolved: "Resolved",
};

const PRIORITY_VARIANT: Record<
  Ticket["priority"],
  "destructive" | "secondary" | "outline"
> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface MyTicketsWidgetProps {
  tickets: Ticket[];
  title?: string;
}

/**
 * Actionable ticket cards. Shares the record-action hook and reassignment
 * dialog with the tasks widget; ticket "complete" means `RESOLVED`.
 */
export function MyTicketsWidget({
  tickets,
  title = "My Tickets",
}: MyTicketsWidgetProps) {
  const { modules } = usePermissions();
  const ticketModule = useMemo(
    () =>
      modules.find((module) => {
        const searchable =
          `${module.key ?? ""} ${module.name} ${module.targetEntity ?? ""}`.toLowerCase();
        return (
          module.targetEntity === "support_tickets" ||
          searchable.includes("ticket") ||
          searchable.includes("support")
        );
      }),
    [modules],
  );
  const { deptKey, moduleKey } = ticketModule
    ? moduleLocation({
        key: ticketModule.key ?? "",
        path: ticketModule.path,
        department:
          typeof ticketModule.department === "object"
            ? ticketModule.department
            : undefined,
      })
    : { deptKey: "", moduleKey: "" };
  const actions = useRecordActions({
    deptKey,
    moduleKey,
    moduleName: "Ticket",
    completeStatus: "RESOLVED",
  });

  const canEdit = Boolean(ticketModule?.actions?.includes("EDIT"));
  const canReassign =
    canEdit &&
    Boolean(ticketModule?.dataScope) &&
    ticketModule?.dataScope !== "SELF";

  if (tickets.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {ticketModule ? (
            <Button asChild size="sm" variant="outline">
              <Link href={ticketModule.path}>View all tickets</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No tickets are assigned to you right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TicketIcon className="size-5" aria-hidden="true" />
          {title} ({tickets.length})
        </CardTitle>
        {ticketModule ? (
          <Button asChild size="sm" variant="outline">
            <Link href={ticketModule.path}>View all tickets</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {tickets.map((ticket) => {
            const busy = actions.busyId === ticket.id;
            const resolved = ticket.status === "resolved";
            return (
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ticket ${ticket.subject}`}
                onClick={() => actions.openRecord(ticket.id)}
                onMouseEnter={() => actions.prefetchRecord(ticket.id)}
                onFocus={() => actions.prefetchRecord(ticket.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    actions.openRecord(ticket.id);
                  }
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors",
                  "hover:border-border hover:bg-accent/40 focus-visible:border-ring focus-visible:outline-none",
                  busy && "opacity-60",
                )}
              >
                <div className="mt-0.5">
                  <CheckCircle2
                    className={cn(
                      "h-4 w-4",
                      resolved ? "text-green-500" : "text-muted-foreground",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    Created: {formatDateTime(ticket.createdAt)}
                    {ticket.assigneeName ? ` • ${ticket.assigneeName}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABEL[ticket.status]}
                    </Badge>
                    <Badge
                      variant={PRIORITY_VARIANT[ticket.priority]}
                      className="text-[10px]"
                    >
                      {ticket.priority.charAt(0).toUpperCase() +
                        ticket.priority.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        aria-label={`Actions for ${ticket.subject}`}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="size-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onSelect={() => actions.openRecord(ticket.id)}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={resolved || !canEdit || busy}
                        onSelect={() => {
                          void actions.complete({
                            id: ticket.id,
                            title: ticket.subject,
                          });
                        }}
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Resolve
                      </DropdownMenuItem>
                      {canReassign ? (
                        <DropdownMenuItem
                          disabled={busy}
                          onSelect={() =>
                            actions.reassign({
                              id: ticket.id,
                              title: ticket.subject,
                              assigneeId: ticket.assigneeId ?? null,
                            })
                          }
                        >
                          <UserPlus className="size-4" aria-hidden="true" />
                          Reassign
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
        {actions.error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {actions.error}
          </p>
        ) : null}
      </CardContent>

      <RecordReassignDialog
        open={Boolean(actions.reassignTarget)}
        deptKey={deptKey}
        moduleKey={moduleKey}
        recordId={actions.reassignTarget?.id ?? null}
        recordTitle={actions.reassignTarget?.title}
        currentAssigneeId={actions.reassignTarget?.assigneeId ?? null}
        onClose={actions.closeReassign}
        onReassigned={actions.handleReassigned}
      />
    </Card>
  );
}
