import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRecordActions } from "@/hooks/useRecordActions";
import { WorkspaceService } from "@/services/workspace";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const recordsKey = ["workspace", "records", "operations", "tasks"] as const;

const page = {
  data: [
    {
      id: "task-1",
      title: "Prepare handover",
      status: "Todo",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
  ],
  meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  scope: "SELF" as const,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(recordsKey, page);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return {
    client,
    ...renderHook(
      () =>
        useRecordActions({
          deptKey: "operations",
          moduleKey: "tasks",
          moduleName: "Task",
          completeStatus: "Completed",
        }),
      { wrapper },
    ),
  };
}

describe("useRecordActions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("optimistically completes a record and invalidates caches", async () => {
    const transition = jest
      .spyOn(WorkspaceService, "transitionRecord")
      .mockResolvedValue(page.data[0] as never);
    const { client, result } = setup();

    let completed = false;
    await act(async () => {
      completed = await result.current.complete({ id: "task-1" });
    });

    expect(completed).toBe(true);
    expect(transition).toHaveBeenCalledWith(
      "operations",
      "tasks",
      "task-1",
      "Completed",
    );
    expect(client.getQueryData(recordsKey)).toMatchObject({
      data: [{ id: "task-1", status: "Completed" }],
    });
    expect(result.current.error).toBeNull();
    expect(result.current.busyId).toBeNull();
  });

  it("rolls the cached status back when the transition fails", async () => {
    jest
      .spyOn(WorkspaceService, "transitionRecord")
      .mockRejectedValueOnce(new Error("Status transition not allowed"));
    const { client, result } = setup();

    let completed = true;
    await act(async () => {
      completed = await result.current.complete({ id: "task-1" });
    });

    expect(completed).toBe(false);
    expect(result.current.error).toBe("Status transition not allowed");
    expect(client.getQueryData(recordsKey)).toEqual(page);
    expect(result.current.busyId).toBeNull();
  });

  it("tracks the reassignment target until it is closed", () => {
    jest
      .spyOn(WorkspaceService, "transitionRecord")
      .mockResolvedValue(page.data[0] as never);
    const { result } = setup();

    act(() => {
      result.current.reassign({
        id: "task-1",
        title: "Prepare handover",
        assigneeId: "user-1",
      });
    });

    expect(result.current.reassignTarget).toEqual({
      id: "task-1",
      title: "Prepare handover",
      assigneeId: "user-1",
    });

    act(() => {
      result.current.closeReassign();
    });

    expect(result.current.reassignTarget).toBeNull();
  });

  it("reports a missing module instead of calling the API", async () => {
    const transition = jest.spyOn(WorkspaceService, "transitionRecord");
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useRecordActions({
          deptKey: "",
          moduleKey: "",
          moduleName: "Task",
        }),
      { wrapper },
    );

    let completed = true;
    await act(async () => {
      completed = await result.current.complete({ id: "task-1" });
    });

    expect(completed).toBe(false);
    expect(result.current.error).toBe(
      "This record is not linked to a module.",
    );
    expect(transition).not.toHaveBeenCalled();
  });
});
