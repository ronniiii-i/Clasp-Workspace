"use client";

import { useMemo } from "react";
import {
  DEFAULT_WORKSPACE_FORMAT,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  type WorkspaceFormatOptions,
} from "@/lib/format";
import type { WorkspaceSettings } from "@/lib/modules";
import { useAuthStore } from "@/stores/auth-store";

export interface WorkspaceFormatters {
  options: WorkspaceFormatOptions;
  date: (value: string | number | Date | null | undefined, fallback?: string) => string;
  dateTime: (
    value: string | number | Date | null | undefined,
    fallback?: string,
  ) => string;
  relative: (
    value: string | number | Date | null | undefined,
    fallback?: string,
  ) => string;
  currency: (
    value: number | string | null | undefined,
    settings?: { compact?: boolean },
  ) => string;
  number: (
    value: number | string | null | undefined,
    settings?: { compact?: boolean; maximumFractionDigits?: number },
  ) => string;
  percent: (value: number | string | null | undefined) => string;
}

/**
 * Workspace-aware formatters bound to the signed-in user's tenant settings.
 * Falls back to the module-level cached defaults before the session loads.
 */
export function useWorkspaceFormat(): WorkspaceFormatters {
  const settings = useAuthStore(
    (state) =>
      state.user?.tenant?.settings ?? state.user?.settings ?? null,
  );

  return useMemo(() => {
    const options: WorkspaceFormatOptions = settings
      ? normalize(settings)
      : DEFAULT_WORKSPACE_FORMAT;

    return {
      options,
      date: (value, fallback) => formatDate(value, options, fallback),
      dateTime: (value, fallback) => formatDateTime(value, options, fallback),
      relative: (value, fallback) => formatRelative(value, options, fallback),
      currency: (value, config) =>
        formatCurrency(value, options, "—", config ?? {}),
      number: (value, config) =>
        formatNumber(value, options, "—", config ?? {}),
      percent: (value) =>
        `${formatNumber(value, options, "—", { maximumFractionDigits: 2 })}%`,
    };
  }, [settings]);
}

function normalize(settings: WorkspaceSettings): WorkspaceFormatOptions {
  return {
    ...DEFAULT_WORKSPACE_FORMAT,
    ...settings,
  };
}
