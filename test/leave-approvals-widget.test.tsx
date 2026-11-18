import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LeaveApprovalsWidget } from "@/app/(dashboard-pages)/dashboard/_components/leave-approvals-widget";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useLeaveWorkflow } from "@/hooks/workspace/useLeaveWorkflow";
import type { LeaveRequestRecord } from "@/lib/workspace-types";

jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: jest.fn(),
}));
jest.mock("@/hooks/workspace/useLeaveWorkflow", () => ({
  useLeaveWorkflow: jest.fn(),
  leaveErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Leave request failed",
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockAuth = useAuth as jest.Mock;
const mockPermissions = usePermissions as jest.Mock;
const mockWorkflow = useLeaveWorkflow as jest.Mock;

const mutateAsync = jest.fn();
const invalidate = jest.fn();

const rows = [
  {
    id: "lr-1",
    userId: "user-2",
    type: "ANNUAL",
    startDate: "2026-11-02T00:00:00.000Z",
    endDate: "2026-11-03T00:00:00.000Z",
    days: 2,
    reason: "Family trip",
    status: "PENDING_TEAM_LEAD",
    currentStage: 1,
    teamLeadId: "user-1",
    user: { id: "user-2", name: "Alex Kim" },
  },
  {
    id: "lr-2",
    userId: "user-3",
    type: "SICK",
    startDate: "2026-11-04T00:00:00.000Z",
    endDate: "2026-11-04T00:00:00.000Z",
    days: 1,
    reason: "Flu",
    status: "PENDING_TEAM_LEAD",
    currentStage: 1,
    teamLeadId: "user-9",
    user: { id: "user-3", name: "Blair Otieno" },
  },
  {
    id: "lr-3",
    userId: "user-4",
    type: "CASUAL",
    startDate: "2026-11-05T00:00:00.000Z",
    endDate: "2026-11-06T00:00:00.000Z",
    days: 2,
    reason: "Moving house",
    status: "PENDING_HR",
    currentStage: 2,
    hodId: "user-1",
    hrApproverId: "hr-2",
    user: { id: "user-4", name: "Casey Rivera" },
  },
  {
    id: "lr-4",
    userId: "user-5",
    type: "ANNUAL",
    startDate: "2026-10-20T00:00:00.000Z",
    endDate: "2026-10-21T00:00:00.000Z",
    days: 2,
    reason: "",
    status: "APPROVED",
    currentStage: 3,
    teamLeadId: "user-1",
    user: { id: "user-5", name: "Drew Patel" },
  },
] as unknown as LeaveRequestRecord[];

describe("LeaveApprovalsWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: "user-1" } });
    mockPermissions.mockReturnValue({
      modules: [
        {
          key: "leave",
          name: "Leave",
          path: "/dept/hr/leave",
          targetEntity: "leave_requests",
          actions: ["VIEW", "EDIT"],
          dataScope: "DEPARTMENT",
          department: { key: "hr", name: "Human Resources" },
        },
      ],
    });
    mockWorkflow.mockReturnValue({
      rows,
      transition: { mutateAsync, isPending: false },
      invalidate,
    });
  });

  it("shows only requests awaiting the current approver", () => {
    render(<LeaveApprovalsWidget />);

    expect(screen.getByText("Alex Kim")).toBeInTheDocument();
    expect(screen.getByText("Casey Rivera")).toBeInTheDocument();
    expect(screen.queryByText("Blair Otieno")).not.toBeInTheDocument();
    expect(screen.queryByText("Drew Patel")).not.toBeInTheDocument();
    expect(
      screen.getByText("Alex Kim").closest("[data-slot='card']"),
    ).toHaveTextContent("Awaiting my approval (2)");
  });

  it("approves a request with an optional note", async () => {
    mutateAsync.mockResolvedValueOnce(undefined);
    render(<LeaveApprovalsWidget />);

    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    const dialog = screen.getByRole("dialog", { name: "Approve leave" });
    fireEvent.change(within(dialog).getByLabelText("Note (optional)"), {
      target: { value: "Enjoy the trip" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: "lr-1",
        input: { action: "APPROVE", note: "Enjoy the trip" },
      });
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("renders nothing when no leave module is available", () => {
    mockPermissions.mockReturnValue({ modules: [] });

    const { container } = render(<LeaveApprovalsWidget />);

    expect(container).toBeEmptyDOMElement();
  });
});
