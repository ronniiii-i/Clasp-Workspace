import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DataTableRenderer } from "@/components/renderers/DataTableRenderer";
import { useWorkspaceRecords, useWorkspaceRecordMutations } from "@/hooks/workspace/useWorkspaceRecords";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { WorkspaceService } from "@/services/workspace";
import type { ModuleDefinition } from "@/lib/workspace-types";
import {
  buildEntityMeta,
  renderRenderer,
} from "./utils/renderers";

jest.mock("@/hooks/workspace/useWorkspaceRecords", () => ({
  useWorkspaceRecords: jest.fn(),
  useWorkspaceRecordMutations: jest.fn(),
}));

jest.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: jest.fn(),
}));

const mockRecords = useWorkspaceRecords as jest.Mock;
const mockMutations = useWorkspaceRecordMutations as jest.Mock;
const mockMediaQuery = useMediaQuery as jest.Mock;

const definition: ModuleDefinition = {
  id: "module-invoices",
  key: "invoices",
  path: "/dept/finance/invoices",
  name: "Invoices",
  icon: "file-text",
  group: "Finance",
  order: 1,
  type: "DATA_TABLE",
  targetEntity: "invoices",
  config: {
    version: 1,
    entity: "invoices",
    columns: [
      { field: "invoiceNumber", label: "Invoice", sortable: true },
      { field: "amount", label: "Amount", type: "currency", sortable: true },
      { field: "status", label: "Status", type: "badge" },
    ],
    defaultSort: { field: "createdAt", dir: "desc" },
    pageSize: 25,
    searchFields: ["invoiceNumber"],
    createEnabled: true,
    filters: [{ field: "status", label: "Status", options: ["DRAFT", "PAID"] }],
  },
  isNavigable: true,
  description: null,
  department: null,
  dataScope: "TENANT",
  actions: ["VIEW", "CREATE", "EDIT", "DELETE"],
  entityMeta: null,
};

const rows = [
  {
    id: "record-1",
    invoiceNumber: "INV-1001",
    amount: 1200,
    status: "PAID",
    customer: { company: "Acme" },
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
  },
];

const page = {
  data: rows,
  meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  scope: "TENANT" as const,
};

const mutationStub = {
  create: { mutate: jest.fn(), isPending: false, error: null },
  update: { mutate: jest.fn(), isPending: false, error: null },
  remove: { mutate: jest.fn(), isPending: false, error: null },
  transition: { mutate: jest.fn(), isPending: false, error: null },
};

function renderTable(actions: Array<"VIEW" | "CREATE" | "EDIT" | "DELETE"> = [
  "VIEW",
  "CREATE",
  "EDIT",
  "DELETE",
]) {
  const entityMeta = buildEntityMeta();
  return renderRenderer(<DataTableRenderer definition={definition} />, {
    definition,
    entityMeta,
    actions,
  });
}

describe("DataTableRenderer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaQuery.mockReturnValue(false);
    mockRecords.mockReturnValue({
      data: page,
      isPending: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    });
    mockMutations.mockReturnValue(mutationStub);
  });

  it("renders records, formatted values and badges", () => {
    renderTable();

    expect(screen.getByText("INV-1001")).toBeInTheDocument();
    expect(screen.getByText(/1,200/)).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("1 record")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });

  it("requests the backend sort when a sortable header is clicked", async () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: /Amount/ }));

    await waitFor(() => {
      const lastCall = mockRecords.mock.calls.at(-1);
      expect(lastCall?.[2].sort).toEqual({ field: "amount", dir: "asc" });
    });
  });

  it("maps the config filter onto an enum filter", async () => {
    renderTable();

    fireEvent.change(screen.getByLabelText("Filter by Status"), {
      target: { value: "PAID" },
    });

    await waitFor(() => {
      const lastCall = mockRecords.mock.calls.at(-1);
      expect(lastCall?.[2].filters).toEqual([
        { field: "status", op: "eq", value: "PAID" },
      ]);
    });
  });

  it("opens the create dialog from entity metadata", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: /New record/ }));

    expect(
      screen.getByRole("textbox", { name: /^Invoice/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("hides create, edit and delete actions without permissions", () => {
    renderTable(["VIEW"]);

    expect(
      screen.queryByRole("button", { name: /New record/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit INV-1001/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete INV-1001/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the record drawer", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: /View INV-1001/ }));

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Last updated")).toBeInTheDocument();
  });

  it("opens the drawer when the row is clicked", () => {
    renderTable();

    fireEvent.click(screen.getByTestId("record-row"));

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByTestId("record-row")).toHaveAttribute(
      "data-record-id",
      "record-1",
    );
  });

  it("opens a record from an ?open= deep link", async () => {
    const getRecord = jest
      .spyOn(WorkspaceService, "getRecord")
      .mockResolvedValue(rows[0]);

    window.history.replaceState({}, "", "/?open=record-1");
    try {
      renderTable();

      await waitFor(() => {
        expect(getRecord).toHaveBeenCalledWith(
          expect.any(String),
          "invoices",
          "record-1",
        );
      });
      await waitFor(() => {
        expect(screen.getByText("Details")).toBeInTheDocument();
      });
    } finally {
      getRecord.mockRestore();
      window.history.replaceState({}, "", "/");
    }
  });

  it("confirms deletion before calling the API", async () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: /Delete INV-1001/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mutationStub.remove.mutate).toHaveBeenCalledWith(
        "record-1",
        expect.any(Object),
      );
    });
  });

  it("keeps a horizontally scrollable table with a sticky identifier column", () => {
    renderTable();

    expect(screen.getByRole("table")).toHaveClass("min-w-[720px]");

    const identifier = screen.getByRole("columnheader", { name: /Invoice/ });
    expect(identifier).toHaveClass("sticky", "left-0");

    // Third and later columns are optional below `sm`.
    expect(screen.getByRole("columnheader", { name: "Status" })).toHaveClass(
      "hidden",
      "sm:table-cell",
    );
    expect(screen.getByRole("columnheader", { name: /Amount/ })).not.toHaveClass(
      "hidden",
    );
  });

  it("shows the export control only when the entity is exportable", () => {
    const exportable = buildEntityMeta({ exportable: true });
    const first = renderRenderer(<DataTableRenderer definition={definition} />, {
      definition,
      entityMeta: exportable,
      actions: ["VIEW"],
    });

    expect(
      screen.getByRole("button", { name: "Export CSV" }),
    ).toBeInTheDocument();
    first.unmount();

    renderRenderer(<DataTableRenderer definition={definition} />, {
      definition,
      entityMeta: buildEntityMeta(),
      actions: ["VIEW"],
    });

    expect(
      screen.queryByRole("button", { name: "Export CSV" }),
    ).not.toBeInTheDocument();
  });

  it("collapses row actions into a touch menu on coarse pointers", () => {
    mockMediaQuery.mockImplementation(
      (query: string) => query === "(pointer: coarse)",
    );
    renderTable();

    const trigger = screen.getByRole("button", {
      name: "Actions for INV-1001",
    });
    expect(trigger).toHaveClass("size-11");
    expect(
      screen.queryByRole("button", { name: /View INV-1001/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit INV-1001/ }),
    ).not.toBeInTheDocument();
  });
});
