import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TrashTable } from "@/components/departments/TrashTable";
import {
  getTrash,
  purgeTrash,
  restoreTrash,
  type TrashResult,
} from "@/services/departments";

jest.mock("@/services/departments", () => ({
  getTrash: jest.fn(),
  restoreTrash: jest.fn(),
  purgeTrash: jest.fn(),
}));

const mockGetTrash = getTrash as jest.Mock;
const mockRestore = restoreTrash as jest.Mock;
const mockPurge = purgeTrash as jest.Mock;

const result: TrashResult = {
  success: true,
  data: [
    {
      entity: "deals",
      id: "deal-1",
      label: "Acme renewal",
      deletedAt: "2026-11-01T10:00:00.000Z",
      deletedBy: { id: "user-1", name: "Ada Lovelace" },
      modulePath: "/dept/sales/deals",
    },
  ],
  counts: { deals: 1 },
  meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
};

describe("TrashTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTrash.mockResolvedValue(result);
    mockRestore.mockResolvedValue({ success: true });
    mockPurge.mockResolvedValue({ success: true });
  });

  it("lists soft-deleted records with counts and labels", async () => {
    render(<TrashTable />);

    await waitFor(() => {
      expect(screen.getByText("Acme renewal")).toBeInTheDocument();
    });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText("Deals").length).toBeGreaterThan(0);
    expect(screen.getByText("1 record · page 1 of 1")).toBeInTheDocument();
  });

  it("restores a record and reloads the list", async () => {
    render(<TrashTable />);

    const restore = await screen.findByRole("button", { name: /Restore/ });
    fireEvent.click(restore);

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith("deals", "deal-1");
    });
    await waitFor(() => {
      expect(mockGetTrash).toHaveBeenCalledTimes(2);
    });
  });

  it("confirms before purging a record", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<TrashTable />);

    const purge = await screen.findByRole("button", { name: /Purge/ });
    fireEvent.click(purge);

    await waitFor(() => {
      expect(confirm).toHaveBeenCalled();
      expect(mockPurge).toHaveBeenCalledWith("deals", "deal-1");
    });

    confirm.mockRestore();
  });

  it("does not purge when the confirmation is dismissed", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrashTable />);

    const purge = await screen.findByRole("button", { name: /Purge/ });
    fireEvent.click(purge);

    expect(mockPurge).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
