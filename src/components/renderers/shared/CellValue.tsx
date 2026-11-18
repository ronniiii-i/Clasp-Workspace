import type { EntityFieldMeta } from "@/lib/workspace-types";
import { Badge } from "@/components/ui/badge";
import {
  badgeTone,
  displayName,
  formatCellText,
  formatEnumLabel,
  isUuid,
} from "./record-utils";

/** Read-only cell renderer shared by tables, drawers and kanban cards. */
export function CellValue({
  value,
  columnType,
  field,
}: {
  value: unknown;
  columnType?: string;
  field?: EntityFieldMeta;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  // A bare foreign key is never a user-facing value.
  if (isUuid(value)) {
    return <span className="text-muted-foreground">—</span>;
  }

  const type = columnType ?? field?.type;

  if (type === "badge" || field?.type === "enum") {
    return (
      <Badge variant="outline" className={badgeTone(value)}>
        {formatEnumLabel(value)}
      </Badge>
    );
  }

  if (field?.type === "boolean" || typeof value === "boolean") {
    return (
      <Badge variant={value ? "secondary" : "outline"}>
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  if (type === "currency" || type === "number") {
    return (
      <span className="font-mono tabular-nums">
        {formatCellText(value, { columnType: type, field })}
      </span>
    );
  }

  if (Array.isArray(value)) {
    const labels = value
      .map((entry) => displayName(entry) ?? (isUuid(entry) ? null : entry))
      .filter((entry) => entry !== null && entry !== undefined && entry !== "");
    if (labels.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <span className="flex flex-wrap gap-1">
        {labels.map((entry, index) => (
          <Badge key={`${String(entry)}-${index}`} variant="secondary">
            {String(entry)}
          </Badge>
        ))}
      </span>
    );
  }

  if (typeof value === "object") {
    const label = displayName(value);
    return (
      <span>{label ?? formatCellText(value, { columnType: type, field })}</span>
    );
  }

  return (
    <span className={type === "date" ? "tabular-nums" : undefined}>
      {formatCellText(value, { columnType: type, field })}
    </span>
  );
}
