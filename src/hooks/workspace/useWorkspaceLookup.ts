"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WorkspaceService } from "@/services/workspace";
import type { LookupQuery } from "@/lib/workspace-types";

const lookupKey = (
  deptKey: string,
  moduleKey: string,
  field: string,
  query: LookupQuery,
) =>
  [
    "workspace",
    "lookup",
    deptKey,
    moduleKey,
    field,
    query.q ?? "",
    query.ids ?? [],
    query.limit ?? 20,
  ] as const;

/** Cached, scoped relation options for one reference field. */
export function useWorkspaceLookup(
  deptKey: string,
  moduleKey: string,
  field: string | null | undefined,
  query: LookupQuery = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: lookupKey(deptKey, moduleKey, field ?? "", query),
    queryFn: () =>
      WorkspaceService.lookup(deptKey, moduleKey, field as string, query),
    enabled:
      Boolean(deptKey && moduleKey && field) && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}
