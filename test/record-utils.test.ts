import type { EntityMeta } from "@/lib/workspace-types";
import {
  columnsFromMeta,
  customFieldEntries,
  displayName,
  fieldMetaForColumn,
  formFieldsFromMeta,
  humanizeKey,
  initialFormValues,
  isHiddenField,
  isUuid,
  relationKeyFor,
  relationValueFor,
  safeCellText,
} from "@/components/renderers/shared/record-utils";

const CONTACT_ID = "eeeeeeee-0000-4000-8000-000000000001";
const OWNER_ID = "12121212-0000-4000-8000-000000000002";

const meta: EntityMeta = {
  key: "deals",
  label: "Deal",
  fields: [
    { name: "name", label: "Deal", type: "text", writable: true },
    {
      name: "contactId",
      label: "Contact",
      type: "text",
      writable: true,
      required: true,
      reference: {
        entity: "contacts",
        labelField: "firstName",
        relationField: "createdBy",
      },
    },
    {
      name: "userId",
      label: "Owner",
      type: "text",
      writable: true,
      reference: { entity: "users", labelField: "name" },
    },
    {
      name: "ip",
      label: "IP address",
      type: "text",
      readOnly: true,
      sensitive: true,
    },
    {
      name: "createdBy",
      label: "Created by",
      type: "json",
      relation: true,
      readOnly: true,
    },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  searchFields: ["name"],
  statusField: "status",
  statusOptions: [],
  numericFields: [],
  dateFields: [],
  groupableFields: [],
  supportedScopes: ["TENANT", "SELF"],
  readOnly: false,
  displayField: "name",
  secondaryDisplayFields: ["amount", "status"],
};

describe("record-utils display helpers", () => {
  it("detects UUID-shaped strings", () => {
    expect(isUuid(CONTACT_ID)).toBe(true);
    expect(isUuid(CONTACT_ID.toUpperCase())).toBe(true);
    expect(isUuid("Ada Lovelace")).toBe(false);
  });

  it("never returns a bare UUID as a display name", () => {
    expect(displayName(CONTACT_ID)).toBeNull();
    expect(displayName({ id: CONTACT_ID, firstName: "Ada", lastName: "L" })).toBe(
      "Ada L",
    );
    expect(displayName({ id: CONTACT_ID, company: "Acme" })).toBe("Acme");
    expect(displayName({ id: CONTACT_ID })).toBeNull();
  });

  it("formats cells without leaking ids or JSON", () => {
    expect(safeCellText(CONTACT_ID)).toBe("—");
    expect(safeCellText({ id: CONTACT_ID, name: "Apollo" })).toBe("Apollo");
    expect(safeCellText([CONTACT_ID, "Apollo"])).toBe("Apollo");
    expect(safeCellText(null)).toBe("—");
  });

  it("humanises field keys", () => {
    expect(humanizeKey("assignedToId")).toBe("Assigned to");
    expect(humanizeKey("first_name")).toBe("First name");
    expect(humanizeKey("customField")).toBe("Custom field");
  });

  it("hides system, sensitive and unreferenced id fields", () => {
    expect(isHiddenField("id")).toBe(true);
    expect(isHiddenField("tenantId")).toBe(true);
    expect(isHiddenField("ip", meta.fields[3])).toBe(true);
    expect(isHiddenField("roleId")).toBe(true);
    expect(isHiddenField("userId", meta.fields[2])).toBe(false);
    expect(isHiddenField("name")).toBe(false);
  });

  it("normalises custom field entries", () => {
    expect(
      customFieldEntries({ budget_range: "10k", priority: 2, skipped: undefined }),
    ).toEqual([
      { key: "budget_range", label: "Budget range", value: "10k" },
      { key: "priority", label: "Priority", value: 2 },
    ]);
    expect(customFieldEntries(null)).toEqual([]);
    expect(customFieldEntries([1, 2])).toEqual([]);
  });

  it("maps a scalar FK to its included relation key", () => {
    expect(relationKeyFor("userId")).toBe("user");
    expect(relationKeyFor("userId", { relationField: "assignedTo" })).toBe(
      "assignedTo",
    );

    const row = { userId: OWNER_ID, assignedTo: { id: OWNER_ID, name: "Ada" } };
    expect(relationValueFor(row, "userId", { relationField: "assignedTo" })).toEqual(
      { id: OWNER_ID, name: "Ada" },
    );
    expect(relationValueFor(null, "userId")).toBeUndefined();
  });

  it("resolves a column by relation key", () => {
    expect(fieldMetaForColumn(meta, "createdBy")?.name).toBe("contactId");
    expect(fieldMetaForColumn(meta, "userId")?.name).toBe("userId");
  });
});

describe("metadata-driven table and form shapes", () => {
  it("builds columns from visible metadata and maps FKs to relations", () => {
    const columns = columnsFromMeta(meta);

    expect(columns.map((column) => column.field)).toEqual([
      "name",
      "createdBy",
      "user",
    ]);
    expect(columns[1].label).toBe("Contact");
    expect(columns[1].sortable).toBe(false);
  });

  it("builds a relation control for reference fields", () => {
    const fields = formFieldsFromMeta(meta);
    const relation = fields.find((field) => field.name === "contactId");

    expect(relation).toMatchObject({
      type: "relation",
      required: true,
      reference: {
        entity: "contacts",
        field: "contactId",
        label: "Contact",
        allowClear: false,
        relationField: "createdBy",
      },
    });
    expect(fields.some((field) => field.name === "createdBy")).toBe(false);
    expect(fields.some((field) => field.name === "ip")).toBe(false);
  });

  it("seeds form values from the relation object id", () => {
    const fields = formFieldsFromMeta(meta);
    const values = initialFormValues(fields, {
      name: "Lead one",
      contactId: CONTACT_ID,
      createdBy: { id: CONTACT_ID, firstName: "Ada" },
      userId: OWNER_ID,
    });

    expect(values.contactId).toBe(CONTACT_ID);
    expect(values.userId).toBe(OWNER_ID);
    expect(values.name).toBe("Lead one");
  });
});
