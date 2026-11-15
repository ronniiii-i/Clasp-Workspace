import { fireEvent, render, screen } from "@testing-library/react";
import { TasksWidget } from "@/app/(dashboard-pages)/dashboard/_components/tasks-widget";
import { usePermissions } from "@/hooks/usePermissions";
import { useRecordActions } from "@/hooks/useRecordActions";
import type { Task } from "@/app/(dashboard-pages)/dashboard/types";

jest.mock("@/hooks/usePermissions", () => ({ usePermissions: jest.fn() }));
jest.mock("@/hooks/useRecordActions", () => ({
  useRecordActions: jest.fn(),
}));

const mockPermissions = usePermissions as jest.Mock;
const mockRecordActions = useRecordActions as jest.Mock;

const actions = {
  complete: jest.fn(),
  reassign: jest.fn(),
  openRecord: jest.fn(),
  busyId: null,
  error: null,
  setError: jest.fn(),
  reassignTarget: null,
  closeReassign: jest.fn(),
  handleReassigned: jest.fn(),
  invalidate: jest.fn(),
};

const tasks: Task[] = [
  {
    id: "task-1",
    title: "Prepare handover",
    dueDate: "2026-10-10T09:00:00.000Z",
    dueSoon: false,
    status: "in-progress",
    progress: 40,
    project: "Acme rollout",
    priority: "high",
    assigneeId: "user-2",
    assigneeName: "Sam Lee",
  },
  {
    id: "task-2",
    title: "Archive invoices",
    dueDate: "2026-10-12T09:00:00.000Z",
    dueSoon: false,
    status: "completed",
    priority: "low",
  },
];

describe("TasksWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.mockReturnValue({
      modules: [
        {
          key: "tasks",
          name: "Tasks",
          path: "/dept/operations/tasks",
          targetEntity: "tasks",
          actions: ["VIEW", "EDIT"],
          dataScope: "DEPARTMENT",
          department: { key: "operations", name: "Operations" },
        },
      ],
    });
    mockRecordActions.mockReturnValue(actions);
  });

  it("shows status, priority and assignee on actionable cards", () => {
    render(<TasksWidget tasks={tasks} />);

    expect(screen.getByText("Prepare handover")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText(/Sam Lee/)).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("opens a task from its card", () => {
    render(<TasksWidget tasks={tasks} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open task Prepare handover" }),
    );

    expect(actions.openRecord).toHaveBeenCalledWith("task-1");
  });

  it("marks an open task complete through the canonical transition", () => {
    render(<TasksWidget tasks={tasks} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mark Prepare handover as completed",
      }),
    );

    expect(actions.complete).toHaveBeenCalledWith({
      id: "task-1",
      title: "Prepare handover",
    });
  });

  it("does not offer completion for finished tasks", () => {
    render(<TasksWidget tasks={tasks} />);

    expect(
      screen.queryByRole("button", { name: "Mark Archive invoices as completed" }),
    ).not.toBeInTheDocument();
  });

  it("is not reassignable for self-scoped modules", () => {
    mockPermissions.mockReturnValue({
      modules: [
        {
          key: "tasks",
          name: "Tasks",
          path: "/dept/operations/tasks",
          targetEntity: "tasks",
          actions: ["VIEW", "EDIT"],
          dataScope: "SELF",
          department: { key: "operations", name: "Operations" },
        },
      ],
    });

    render(<TasksWidget tasks={tasks} />);

    expect(mockRecordActions).toHaveBeenCalledWith(
      expect.objectContaining({ moduleName: "Task", completeStatus: "Completed" }),
    );
  });
});
