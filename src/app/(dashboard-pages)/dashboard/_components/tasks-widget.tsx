// src/app/(dashboard-pages)/dashboard/_components/tasks-widget.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListTodo,
  Loader2,
  MoreHorizontal,
  UserPlus,
} from "lucide-react";

import { Task } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

interface TasksWidgetProps {
  tasks: Task[];
}

const STATUS_LABEL: Record<Task["status"], string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
};

const PRIORITY_VARIANT: Record<
  NonNullable<Task["priority"]>,
  "destructive" | "secondary" | "outline"
> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

function priorityLabel(priority?: Task["priority"]) {
  return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : null;
}

/**
 * Actionable "My Tasks" dashboard widget.
 *
 * Every card opens the record drawer through `?open=<id>`; complete/reassign
 * run through the shared record-action hook. Interactive controls stop click
 * propagation so the card itself stays a single large target.
 */
export function TasksWidget({ tasks }: TasksWidgetProps) {
  const { modules } = usePermissions();
  const taskModule = useMemo(
    () =>
      modules.find((module) => {
        const searchable =
          `${module.key ?? ""} ${module.name} ${module.targetEntity ?? ""}`.toLowerCase();
        return searchable.includes("task");
      }),
    [modules],
  );
  const { deptKey, moduleKey } = taskModule
    ? moduleLocation({
        key: taskModule.key ?? "",
        path: taskModule.path,
        department:
          typeof taskModule.department === "object"
            ? taskModule.department
            : undefined,
      })
    : { deptKey: "", moduleKey: "" };
  const actions = useRecordActions({
    deptKey,
    moduleKey,
    moduleName: "Task",
    completeStatus: "Completed",
  });

  const canEdit = Boolean(taskModule?.actions?.includes("EDIT"));
  const canReassign =
    canEdit &&
    Boolean(taskModule?.dataScope) &&
    taskModule?.dataScope !== "SELF";

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Tasks</CardTitle>
          {taskModule ? (
            <Button asChild size="sm" variant="outline">
              <Link href={taskModule.path}>View all tasks</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No tasks assigned currently
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Tasks ({tasks.length})</CardTitle>
        {taskModule ? (
          <Button asChild size="sm" variant="outline">
            <Link href={taskModule.path}>
              <ListTodo className="mr-2 size-4" />
              View all tasks
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {tasks.map((task) => {
            const busy = actions.busyId === task.id;
            const completed = task.status === "completed";
            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                aria-label={`Open task ${task.title}`}
                onClick={() => actions.openRecord(task.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    actions.openRecord(task.id);
                  }
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors",
                  "hover:border-border hover:bg-accent/40 focus-visible:border-ring focus-visible:outline-none",
                  busy && "opacity-60",
                )}
              >
                <div className="mt-1">
                  {completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : task.dueSoon ? (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due: {formatDateTime(task.dueDate)}
                    {task.project ? ` • ${task.project}` : ""}
                    {task.assigneeName ? ` • ${task.assigneeName}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABEL[task.status]}
                    </Badge>
                    {task.priority ? (
                      <Badge
                        variant={PRIORITY_VARIANT[task.priority]}
                        className="text-[10px]"
                      >
                        {priorityLabel(task.priority)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {task.status === "in-progress" ? (
                  <Progress value={task.progress} className="mt-2 h-2 w-16" />
                ) : null}
                {!completed && canEdit && taskModule ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="size-8 shrink-0 p-0"
                    aria-label={`Mark ${task.title} as completed`}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void actions.complete({ id: task.id, title: task.title });
                    }}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                  </Button>
                ) : null}
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
                        aria-label={`Actions for ${task.title}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onSelect={() => actions.openRecord(task.id)}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={completed || !canEdit || busy}
                        onSelect={() => {
                          void actions.complete({
                            id: task.id,
                            title: task.title,
                          });
                        }}
                      >
                        <Check className="size-4" aria-hidden="true" />
                        Mark complete
                      </DropdownMenuItem>
                      {canReassign ? (
                        <DropdownMenuItem
                          disabled={busy}
                          onSelect={() =>
                            actions.reassign({
                              id: task.id,
                              title: task.title,
                              assigneeId: task.assigneeId ?? null,
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
          <p
            role="alert"
            className="mt-4 text-sm text-destructive"
          >
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
