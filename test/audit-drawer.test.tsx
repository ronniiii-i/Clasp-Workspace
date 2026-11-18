import { render, screen } from "@testing-library/react";
import { RecordDrawer } from "@/components/renderers/shared/RecordDrawer";
import type { WorkspaceRecord } from "@/lib/workspace-types";
import { buildEntityMeta } from "./utils/renderers";

const auditMeta = buildEntityMeta({
  key: "audit_logs",
  label: "Audit log",
  displayField: "action",
  secondaryDisplayFields: ["entity"],
  fields: [
    { name: "action", label: "Action", type: "text", writable: false },
    { name: "entity", label: "Entity", type: "text", writable: false },
    { name: "before", label: "Before", type: "json", writable: false },
    { name: "after", label: "After", type: "json", writable: false },
  ],
});

const auditRecord: WorkspaceRecord = {
  id: "log-1",
  action: "UPDATE",
  entity: "deals",
  before: { status: "DRAFT", password: "hunter2" },
  after: { status: "PAID", password: "hunter2" },
};

describe("RecordDrawer audit diff", () => {
  it("renders the before/after diff instead of raw payload fields", () => {
    render(
      <RecordDrawer
        open
        onClose={jest.fn()}
        title="Audit entry"
        record={auditRecord}
        meta={auditMeta}
      />,
    );

    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();
    // The diff table owns the only Before/After headers.
    expect(screen.getAllByText("Before")).toHaveLength(1);
    expect(screen.getAllByText("After")).toHaveLength(1);
    expect(screen.getAllByText("[redacted]").length).toBeGreaterThan(0);
  });

  it("does not render a diff section for non-audit entities", () => {
    const meta = buildEntityMeta();
    render(
      <RecordDrawer
        open
        onClose={jest.fn()}
        title="Invoice"
        record={{ id: "invoice-1", invoiceNumber: "INV-1" }}
        meta={meta}
      />,
    );

    expect(screen.queryByText("Changes")).not.toBeInTheDocument();
  });
});
