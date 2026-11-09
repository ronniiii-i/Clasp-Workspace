import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import {
  WorkflowRenderer,
  workingDaysBetween,
} from "@/components/renderers/WorkflowRenderer";
import {
  useLeaveTimeline,
  useLeaveWorkflow,
} from "@/hooks/workspace/useLeaveWorkflow";
import { useAuthStore } from "@/stores/auth-store";
import type { DataScope, Permission } from "@/lib/modules";
import type {
  LeaveRequestRecord,
  ModuleDefinition,
  WorkflowConfig,
} from "@/lib/workspace-types";
import { renderRenderer } from "./utils/renderers";

jest.mock("@/hooks/workspace/useLeaveWorkflow", () => ({
  useLeaveWorkflow: jest.fn(),
  useLeaveTimeline: jest.fn(),
  leaveErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Something went wrong.",
}));

const mockWorkflow = useLeaveWorkflow as jest.Mock;
const mockTimeline = useLeaveTimeline as jest.Mock;

const REQUESTER = {
  id: "user-requester",
  name: "Ada Okafor",
  email: "ada@example.com",
  departmentId: "dept-hr",
};

const APPROVER = {
  id: "user-approver",
  name: "Bola Adeyemi",
  email: "bola@example.com",
  departmentId: "dept-hr",
};

const HR = {
  id: "user-hr",
  name: "Chidi Eze",
  email: "chidi@example.com",
  departmentId: "dept-hr",
};

const config: WorkflowConfig = {
  version: 1,
  entity: "leave_requests",
  workflow: "leave-approval",
  stages: [
    { value: "PENDING_TEAM_LEAD", label: "Team Lead" },
    { value: "PENDING_HR", label: "HR" },
  ],
  requesterFields: ["type", "startDate", "endDate", "reason"],
  allowCreate: true,
  allowCancel: true,
};

const definition: ModuleDefinition = {
  id: "module-leave",
  key: "attendance-leave-management",
  path: "/dept/human_resources/attendance-leave-management",
  name: "Attendance & Leave",
  icon: "calendar-days",
  group: "Human Resources",
  order: 3,
  type: "WORKFLOW",
  targetEntity: "leave_requests",
  config,
  isNavigable: true,
  description: null,
  department: {
    id: "dept-hr",
    key: "human_resources",
    name: "Human Resources",
    sortOrder: 1,
  },
  dataScope: "DEPARTMENT",
  actions: ["VIEW", "CREATE", "EDIT"],
  entityMeta: null,
};

const rows: LeaveRequestRecord[] = [
  {
    id: "leave-1",
    userId: REQUESTER.id,
    type: "ANNUAL",
    startDate: "2026-11-09T00:00:00.000Z",
    endDate: "2026-11-13T00:00:00.000Z",
    days: 5,
    reason: "Family visit",
    status: "PENDING_TEAM_LEAD",
    currentStage: 1,
    teamLeadId: APPROVER.id,
    hodId: null,
    hrApproverId: HR.id,
    submittedAt: "2026-11-01T09:00:00.000Z",
    createdAt: "2026-11-01T09:00:00.000Z",
    user: REQUESTER,
    teamLead: APPROVER,
    hod: null,
    hrApprover: HR,
  },
  {
    id: "leave-2",
    userId: "user-other",
    type: "SICK",
    startDate: "2026-10-20T00:00:00.000Z",
    endDate: "2026-10-21T00:00:00.000Z",
    days: 2,
    reason: "Flu",
    status: "PENDING_HR",
    currentStage: 2,
    teamLeadId: null,
    hodId: null,
    hrApproverId: APPROVER.id,
    submittedAt: "2026-10-18T08:00:00.000Z",
    createdAt: "2026-10-18T08:00:00.000Z",
    user: { id: "user-other", name: "Dayo Bello" },
    teamLead: null,
    hod: null,
    hrApprover: APPROVER,
  },
  {
    id: "leave-3",
    userId: "user-other",
    type: "CASUAL",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-01T00:00:00.000Z",
    days: 1,
    reason: "Personal",
    status: "APPROVED",
    currentStage: 2,
    teamLeadId: APPROVER.id,
    hodId: null,
    hrApproverId: HR.id,
    decidedById: HR.id,
    decidedAt: "2026-08-30T12:00:00.000Z",
    submittedAt: "2026-08-29T12:00:00.000Z",
    createdAt: "2026-08-29T12:00:00.000Z",
    user: { id: "user-other", name: "Dayo Bello" },
    teamLead: APPROVER,
    hod: null,
    hrApprover: HR,
    decidedBy: HR,
  },
];

const page = {
  data: rows,
  meta: { page: 1, pageSize: 100, total: rows.length, totalPages: 1 },
  scope: "DEPARTMENT" as const,
};

const createMutate = jest.fn();
const transitionMutate = jest.fn();

const records = {
  data: page,
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
};

function renderWorkflow(options: {
  actions?: Permission[];
  dataScope?: DataScope;
} = {}) {
  mockWorkflow.mockReturnValue({
    records,
    rows,
    invalidate: jest.fn(),
    create: { mutate: createMutate, isPending: false, error: null },
    transition: { mutate: transitionMutate, isPending: false, error: null },
  });

  return renderRenderer(<WorkflowRenderer definition={definition} />, {
    definition,
    actions: options.actions ?? ["VIEW", "CREATE", "EDIT"],
    dataScope: options.dataScope ?? "DEPARTMENT",
  });
}

function setUser(user: Partial<typeof REQUESTER> | null) {
  act(() => {
    useAuthStore.setState({
      user: user
        ? {
            id: user.id ?? APPROVER.id,
            email: user.email ?? APPROVER.email,
            name: user.name ?? APPROVER.name,
            role: { id: "role-hod", name: "HOD", slug: "hod" },
            isVerified: true,
            department: null,
            managedDepartment: null,
          }
        : null,
    });
  });
}

/** Radix tabs activate on mouse down. */
function openApprovalsTab() {
  fireEvent.mouseDown(
    screen.getByRole("tab", { name: "Awaiting my approval" }),
  );
}

describe("WorkflowRenderer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser({ ...APPROVER });
    mockTimeline.mockReturnValue({
      data: {
        success: true,
        request: rows[0],
        timeline: [
          {
            id: "audit-1",
            action: "SUBMIT",
            actorId: REQUESTER.id,
            actorName: REQUESTER.name,
            at: "2026-11-01T09:00:00.000Z",
            status: "PENDING_TEAM_LEAD",
            note: null,
            override: false,
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    });
  });

  afterAll(() => setUser(null));

  it("computes working days inclusive of both endpoints", () => {
    expect(workingDaysBetween("2026-11-09", "2026-11-13")).toBe(5);
    expect(workingDaysBetween("2026-11-13", "2026-11-16")).toBe(2);
    expect(workingDaysBetween("2026-11-14", "2026-11-15")).toBe(0);
  });

  it("renders summary cards and the current user's requests", () => {
    setUser({ ...REQUESTER });
    renderWorkflow();

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("Ada Okafor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team Lead review").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Dayo Bello")).toHaveLength(0);
    expect(screen.getByText("1 request")).toBeInTheDocument();
  });

  it("shows requests awaiting the current approver", () => {
    renderWorkflow();

    openApprovalsTab();

    expect(screen.getAllByText("Ada Okafor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dayo Bello").length).toBeGreaterThan(0);
    expect(screen.getByText("2 requests")).toBeInTheDocument();
  });

  it("only offers the All tab for department or tenant scope", () => {
    const { unmount } = renderWorkflow({ dataScope: "DEPARTMENT" });
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    unmount();

    renderWorkflow({ dataScope: "SELF" });
    expect(screen.queryByRole("tab", { name: "All" })).not.toBeInTheDocument();
  });

  it("submits a leave request with computed working days", async () => {
    setUser({ ...REQUESTER });
    renderWorkflow();

    fireEvent.click(screen.getByRole("button", { name: /New request/ }));

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-11-09" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-11-13" },
    });
    expect(screen.getByText("Working days:")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Family visit" },
    });

    const form = document.getElementById("leave-request-form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        {
          type: "ANNUAL",
          startDate: "2026-11-09",
          endDate: "2026-11-13",
          reason: "Family visit",
        },
        expect.any(Object),
      );
    });
  });

  it("requires a note before rejecting and sends it with the transition", async () => {
    renderWorkflow();
    openApprovalsTab();

    fireEvent.click(
      screen.getByRole("button", { name: /View leave request for Ada Okafor/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    const confirm = screen.getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^Note/), {
      target: { value: "Coverage is required that week." },
    });

    expect(
      screen.getByRole("button", { name: "Reject" }),
    ).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(transitionMutate).toHaveBeenCalledWith(
        {
          id: "leave-1",
          input: {
            action: "REJECT",
            note: "Coverage is required that week.",
          },
        },
        expect.any(Object),
      );
    });
  });

  it("opens the detail timeline and keeps the current actor from approving their own request", () => {
    setUser({ ...REQUESTER });
    renderWorkflow();

    fireEvent.click(
      screen.getByRole("button", { name: /View leave request for Ada Okafor/ }),
    );

    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText(/by Ada Okafor/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel request" }),
    ).toBeInTheDocument();
  });

  it("hides create and decision actions without module permissions", () => {
    renderWorkflow({ actions: ["VIEW"] });

    expect(
      screen.queryByRole("button", { name: /New request/ }),
    ).not.toBeInTheDocument();

    openApprovalsTab();

    fireEvent.click(
      screen.getByRole("button", { name: /View leave request for Ada Okafor/ }),
    );
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });
});
