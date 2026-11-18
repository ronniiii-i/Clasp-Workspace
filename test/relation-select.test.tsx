import { fireEvent, screen } from "@testing-library/react";
import type { ModuleDefinition } from "@/lib/workspace-types";
import { renderRenderer } from "./utils/renderers";
import { RelationSelect } from "@/components/renderers/shared/RelationSelect";
import type { FieldDefinition } from "@/components/renderers/shared/record-utils";

const mockLookup = jest.fn();

jest.mock("@/hooks/workspace/useWorkspaceLookup", () => ({
  useWorkspaceLookup: (...args: unknown[]) => mockLookup(...args),
}));

const definition: ModuleDefinition = {
  id: "module-deals",
  key: "deals",
  path: "/dept/sales/deals",
  name: "Deals",
  icon: "target",
  group: "Sales",
  order: 1,
  type: "DATA_TABLE",
  targetEntity: "deals",
  config: {
    version: 1,
    entity: "deals",
    columns: [],
    defaultSort: { field: "createdAt", dir: "desc" },
    pageSize: 25,
    searchFields: [],
    createEnabled: true,
    filters: [],
  },
  isNavigable: true,
  description: null,
  department: { id: "dept-1", key: "sales", name: "Sales", sortOrder: 1 },
  dataScope: "TENANT",
  actions: ["VIEW", "CREATE", "EDIT"],
  entityMeta: null,
};

const field: FieldDefinition = {
  name: "contactId",
  label: "Contact",
  type: "relation",
  required: true,
  mapTo: "column",
  reference: {
    entity: "contacts",
    field: "contactId",
    label: "Contact",
    allowClear: false,
  },
};

const options = [
  {
    value: "contact-1",
    label: "Ada Lovelace",
    secondary: "Analytical",
    meta: {},
  },
];

function renderSelect(value = "", onChange = jest.fn()) {
  return {
    onChange,
    ...renderRenderer(
      <RelationSelect field={field} value={value} onChange={onChange} />,
      { definition, entityMeta: null, actions: ["VIEW"] },
    ),
  };
}

describe("RelationSelect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLookup.mockReturnValue({
      data: { field: "contactId", options },
      isFetching: false,
    });
  });

  it("queries the module-scoped lookup for the field", () => {
    renderSelect();

    expect(mockLookup).toHaveBeenCalledWith(
      "sales",
      "deals",
      "contactId",
      { q: "", limit: 20 },
    );
  });

  it("lists options and emits the selected id", () => {
    const { onChange } = renderSelect();

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    fireEvent.click(screen.getByRole("option", { name: /Ada Lovelace/ }));

    expect(onChange).toHaveBeenCalledWith("contact-1");
  });

  it("shows the selected label without a second query when found", () => {
    renderSelect("contact-1");

    expect(screen.getByRole("combobox")).toHaveValue("Ada Lovelace");
    expect(mockLookup).toHaveBeenCalledWith(
      "sales",
      "deals",
      "contactId",
      { ids: ["contact-1"], limit: 1 },
      { enabled: true },
    );
  });

  it("does not offer clearing when the field is required", () => {
    renderSelect("contact-1");

    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).not.toBeInTheDocument();
  });

  it("clears an optional selection", () => {
    const optional: FieldDefinition = {
      ...field,
      required: false,
      reference: { ...field.reference!, allowClear: true },
    };
    const onChange = jest.fn();

    renderRenderer(
      <RelationSelect field={optional} value="contact-1" onChange={onChange} />,
      { definition, entityMeta: null, actions: ["VIEW"] },
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onChange).toHaveBeenCalledWith("");
  });
});
