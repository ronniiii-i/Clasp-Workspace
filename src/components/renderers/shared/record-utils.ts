import type { EntityFieldMeta, EntityMeta, TableColumnConfig } from "@/lib/workspace-types";
import {
  formatCurrency as formatWorkspaceCurrency,
  formatDate,
  formatDateTime,
  formatEnum,
  formatNumber as formatWorkspaceNumber,
} from "@/lib/format";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface FieldDefinition {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "currency"
    | "date"
    | "select"
    | "checkbox"
    | "email"
    | "relation";
  required?: boolean;
  options?: string[];
  mapTo?: "column" | "customFields";
  placeholder?: string;
  reference?: {
    entity: string;
    field: string;
    label: string;
    allowClear?: boolean;
    relationField?: string;
  };
}

export interface CustomFieldEntry {
  key: string;
  label: string;
  value: unknown;
}

const READ_ONLY_NAMES = new Set([
  "id",
  "tenantId",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "deletedAt",
  "deletedById",
]);

const SYSTEM_FIELDS = new Set([
  "id",
  "tenantId",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "deletedAt",
  "deletedById",
]);

/** UUID-shaped strings are never rendered as user-facing labels. */
export function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

/** `assignedToId` -> `Assigned to`, `createdAt` -> `Created at`. */
export function humanizeKey(key: string): string {
  const spaced = String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const withoutId = spaced.replace(/\sId$/i, "");
  if (!withoutId) return spaced;
  return withoutId.charAt(0).toUpperCase() + withoutId.slice(1).toLowerCase();
}

/**
 * Human label for a relation value or record.
 *
 * Checks the common display columns in order and refuses bare UUIDs so a raw
 * id can never leak into a cell, chip or aria-label.
 */
export function displayName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || isUuid(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const names = value
      .map((entry) => displayName(entry))
      .filter((entry): entry is string => Boolean(entry));
    return names.length > 0 ? names.join(", ") : null;
  }
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const first = record.firstName ?? record.first_name;
  const last = record.lastName ?? record.last_name;
  const combined = [first, last]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();

  const candidates: unknown[] = [
    record.label,
    record.name,
    record.title,
    record.subject,
    record.number,
    record.invoiceNumber,
    combined || undefined,
    record.company,
    record.email,
    record.key,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !isUuid(candidate)) {
      return candidate.trim();
    }
  }
  return null;
}

/** Plain text for a cell that never returns raw JSON or a UUID. */
export function safeCellText(
  value: unknown,
  field?: EntityFieldMeta,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (isUuid(value)) return "—";

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => displayName(entry) ?? (isUuid(entry) ? null : entry))
      .filter((entry) => entry !== null && entry !== undefined && entry !== "")
      .map((entry) => String(entry));
    return parts.length > 0 ? parts.join(", ") : "—";
  }

  if (typeof value === "object") {
    return displayName(value) ?? "—";
  }

  return formatCellText(value, { field });
}

/**
 * Fixed system fields and anything the backend marked sensitive are hidden
 * from tables and drawers. A raw `*Id` is hidden unless the backend supplies a
 * relation reference for it.
 */
export function isHiddenField(
  name: string,
  field?: EntityFieldMeta,
): boolean {
  if (SYSTEM_FIELDS.has(name)) return true;
  if (field?.sensitive) return true;
  if (/Id$/.test(name) && !field?.reference) return true;
  return false;
}

/** Normalise `customFields` JSON into labelled entries for the drawer. */
export function customFieldEntries(value: unknown): CustomFieldEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => ({
      key,
      label: humanizeKey(key),
      value: entry,
    }));
}

/** Relation key for a scalar FK (`assignedToId` -> `assignedTo`). */
export function relationKeyFor(
  fieldName: string,
  reference?: { relationField?: string },
): string {
  return reference?.relationField || fieldName.replace(/Id$/, "");
}

/** Prefer the included relation object when a column names a scalar FK. */
export function relationValueFor(
  record: Record<string, unknown> | null | undefined,
  fieldName: string,
  reference?: { relationField?: string },
): unknown {
  if (!record) return undefined;
  const relation = record[relationKeyFor(fieldName, reference)];
  if (relation !== undefined && relation !== null) return relation;
  return record[fieldName];
}

/** Read a dotted path (`customer.company`) without throwing on nulls. */
export function getPath(
  source: unknown,
  path: string,
): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function fieldMetaFor(
  meta: EntityMeta | null | undefined,
  path: string,
): EntityFieldMeta | undefined {
  if (!meta) return undefined;
  return meta.fields.find((field) => field.name === path);
}

/** Resolve a column path that may be a scalar FK or its relation key. */
export function fieldMetaForColumn(
  meta: EntityMeta | null | undefined,
  path: string,
): EntityFieldMeta | undefined {
  if (!meta) return undefined;
  return meta.fields.find(
    (field) =>
      field.name === path ||
      (field.reference !== undefined &&
        relationKeyFor(field.name, field.reference) === path),
  );
}

export function isCurrencyField(field?: EntityFieldMeta): boolean {
  return field?.type === "currency";
}

export function isDateField(field?: EntityFieldMeta): boolean {
  return field?.type === "date";
}

export function formatCurrencyValue(value: unknown): string {
  return formatWorkspaceCurrency(value as number);
}

export function formatNumber(value: unknown): string {
  return formatWorkspaceNumber(value as number);
}

/** Plain text for a cell, driven by the column or entity field metadata. */
export function formatCellText(
  value: unknown,
  options: {
    columnType?: string;
    field?: EntityFieldMeta;
  } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => displayName(entry) ?? (isUuid(entry) ? null : entry))
      .filter((entry) => entry !== null && entry !== undefined && entry !== "")
      .map((entry) => String(entry));
    return parts.length > 0 ? parts.join(", ") : "—";
  }

  if (typeof value === "object") {
    return displayName(value) ?? "—";
  }

  const type = options.columnType ?? options.field?.type;

  if (type === "currency") return formatCurrencyValue(value);
  if (type === "number") return formatNumber(value);
  if (type === "date") return formatDate(String(value));
  if (type === "boolean") return value ? "Yes" : "No";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  return String(value);
}

export function formatEnumLabel(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return formatEnum(String(value));
}

export function formatTimestamp(value: unknown): string {
  return formatDateTime(value as string);
}

/** Fallback table columns when a module config has none. */
export function columnsFromMeta(
  meta: EntityMeta | null | undefined,
): TableColumnConfig[] {
  if (!meta) return [];
  return meta.fields
    .filter((field) => !field.relation)
    .filter((field) => !isHiddenField(field.name, field))
    .slice(0, 6)
    .map((field) => {
      if (field.reference) {
        // Read the included relation object rather than the raw foreign key.
        return {
          field: relationKeyFor(field.name, field.reference),
          label: field.label,
          type: "text",
          sortable: false,
          filterable: false,
        };
      }
      return {
        field: field.name,
        label: field.label,
        type: field.type,
        sortable: field.sortable,
        filterable: field.filterable,
      };
    });
}

function formTypeFor(field: EntityFieldMeta): FieldDefinition["type"] | null {
  switch (field.type) {
    case "enum":
      return "select";
    case "boolean":
      return "checkbox";
    case "number":
      return "number";
    case "currency":
      return "currency";
    case "date":
      return "date";
    case "email":
      return "email";
    case "text":
      return field.name.toLowerCase().includes("description")
        ? "textarea"
        : "text";
    default:
      return null;
  }
}

/** Convert entity metadata into writable form fields. */
export function formFieldsFromMeta(
  meta: EntityMeta | null | undefined,
): FieldDefinition[] {
  if (!meta) return [];

  return meta.fields.flatMap<FieldDefinition>((field) => {
    if (field.relation || field.readOnly || field.writable === false) return [];
    if (READ_ONLY_NAMES.has(field.name)) return [];

    if (field.reference) {
      return [
        {
          name: field.name,
          label: field.label,
          type: "relation" as const,
          required: field.required,
          mapTo: "column" as const,
          reference: {
            entity: field.reference.entity,
            field: field.name,
            label: field.label,
            allowClear: !field.required,
            relationField: field.reference.relationField,
          },
        },
      ];
    }

    const type = formTypeFor(field);
    if (!type) return [];

    return [
      {
        name: field.name,
        label: field.label,
        type,
        required: field.required,
        options: field.enumValues,
        mapTo: "column" as const,
      },
    ];
  });
}

/** Initial values for a create/edit dialog from an existing row. */
export function initialFormValues(
  fields: FieldDefinition[],
  record?: Record<string, unknown> | null,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = record ? getPath(record, field.name) : undefined;

    if (field.type === "relation") {
      const relation = record
        ? relationValueFor(record, field.name, field.reference)
        : undefined;
      const scalar =
        typeof raw === "string" && raw.length > 0
          ? raw
          : relation && typeof relation === "object"
            ? (relation as Record<string, unknown>).id
            : undefined;
      values[field.name] = typeof scalar === "string" ? scalar : "";
    } else if (field.type === "checkbox") {
      values[field.name] = Boolean(raw);
    } else if (field.type === "date" && typeof raw === "string") {
      values[field.name] = raw.slice(0, 10);
    } else {
      values[field.name] = raw === null || raw === undefined ? "" : String(raw);
    }
  }

  return values;
}

/** Convert form strings back into the types the workspace API expects. */
export function prepareFormValues(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.name];

    if (field.type === "checkbox") {
      payload[field.name] = Boolean(raw);
      continue;
    }

    if (raw === undefined || raw === null || raw === "") continue;

    if (field.type === "number" || field.type === "currency") {
      payload[field.name] = Number(raw);
      continue;
    }

    payload[field.name] = String(raw);
  }

  return payload;
}

const TONE_CLASSES: Record<string, string> = {
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  slate: "border-border bg-muted text-muted-foreground",
};

const STATUS_TONES: Record<string, keyof typeof TONE_CLASSES> = {
  paid: "emerald",
  won: "emerald",
  completed: "emerald",
  resolved: "emerald",
  active: "emerald",
  present: "emerald",
  published: "emerald",
  customer: "emerald",
  pending: "amber",
  proposal: "amber",
  negotiation: "amber",
  review: "violet",
  qualified: "blue",
  "in progress": "blue",
  "in_progress": "blue",
  open: "blue",
  prospect: "blue",
  lead: "slate",
  todo: "slate",
  draft: "slate",
  archived: "slate",
  overdue: "rose",
  cancelled: "rose",
  lost: "rose",
  absent: "rose",
  fired: "rose",
  suspended: "rose",
  closed: "slate",
};

export function badgeTone(value: unknown): string {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const tone = STATUS_TONES[key] ?? "slate";
  return TONE_CLASSES[tone];
}

/** Column label lookup with a humanised fallback. */
export function labelForField(
  meta: EntityMeta | null | undefined,
  path: string,
): string {
  return fieldMetaFor(meta, path)?.label ?? formatEnum(path);
}
