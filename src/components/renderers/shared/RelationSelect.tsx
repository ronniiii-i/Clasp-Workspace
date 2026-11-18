"use client";

import { useMemo, useState } from "react";
import { useModuleContext } from "../ModuleContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useWorkspaceLookup } from "@/hooks/workspace/useWorkspaceLookup";
import type { LookupOption } from "@/lib/workspace-types";
import type { FieldDefinition } from "./record-utils";
import { Combobox, type ComboboxOption } from "./Combobox";

interface RelationSelectProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  id?: string;
}

function dedupe(options: LookupOption[]): ComboboxOption[] {
  const seen = new Set<string>();
  const result: ComboboxOption[] = [];
  for (const option of options) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    result.push({
      value: option.value,
      label: option.label,
      secondary: option.secondary ?? null,
    });
  }
  return result;
}

/**
 * Lookup-backed picker for a scalar FK. The value is always the id; labels are
 * resolved server-side so a cross-tenant or deleted id can never be displayed.
 */
export function RelationSelect({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  id,
}: RelationSelectProps) {
  const { definition } = useModuleContext();
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, 250);

  const deptKey = definition.department?.key ?? "";
  const moduleKey = definition.key;
  const fieldName = field.reference?.field ?? field.name;
  const selectedId = typeof value === "string" ? value : "";

  const search = useWorkspaceLookup(deptKey, moduleKey, fieldName, {
    q: debouncedTerm,
    limit: 20,
  });

  const selected = useWorkspaceLookup(
    deptKey,
    moduleKey,
    fieldName,
    { ids: selectedId ? [selectedId] : [], limit: 1 },
    { enabled: Boolean(selectedId) },
  );

  const options = useMemo(
    () => dedupe([...(selected.data?.options ?? []), ...(search.data?.options ?? [])]),
    [selected.data, search.data],
  );

  const selectedLabel = options.find((option) => option.value === selectedId)
    ?.label;

  return (
    <Combobox
      id={id ?? `field-${field.name}`}
      value={selectedId}
      selectedLabel={selectedLabel}
      options={options}
      onChange={(option) => {
        onChange(option?.value ?? "");
        onBlur?.();
      }}
      onSearch={setTerm}
      placeholder={
        field.placeholder ??
        `Search ${field.reference?.label ?? field.label}…`
      }
      emptyMessage={`No ${(field.reference?.label ?? field.label).toLowerCase()} found`}
      loading={search.isFetching || selected.isFetching}
      disabled={disabled || !deptKey}
      allowClear={field.reference?.allowClear ?? !field.required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id ?? `field-${field.name}`}-error` : undefined}
    />
  );
}
