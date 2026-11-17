"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { buildRecordsSearchParams } from "@/services/workspace";
import type { RecordFilter, RecordSort } from "@/lib/workspace-types";

export interface ExportButtonProps {
  deptKey: string;
  moduleKey: string;
  filters?: RecordFilter[];
  sort?: RecordSort;
  disabled?: boolean;
  hidden?: boolean;
  className?: string;
}

export function ExportButton({
  deptKey,
  moduleKey,
  filters,
  sort,
  disabled = false,
  hidden = false,
  className,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  if (hidden) return null;

  const handleExport = async () => {
    if (loading || disabled) return;
    setLoading(true);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API ?? "").replace(/\/+$/, "");
      const params = new URLSearchParams(buildRecordsSearchParams({ filters, sort }));
      params.set("format", "csv");

      const url = `${apiBase}/workspace/modules/${encodeURIComponent(deptKey)}/${encodeURIComponent(moduleKey)}/export?${params.toString()}`;
      const token = useAuthStore.getState().token;

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 413) {
          toast.error("Export is too large. Please refine your filters.");
          return;
        }

        let message = `Export failed: ${response.status} ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson?.code === "EXPORT_TOO_LARGE") {
            toast.error("Export is too large. Please refine your filters.");
            return;
          }
          if (errorJson?.message) {
            message = Array.isArray(errorJson.message)
              ? errorJson.message.join(", ")
              : String(errorJson.message);
          }
        } catch {
          // ignore json parse error
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = downloadUrl;
      link.download = `${deptKey}-${moduleKey}-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Export downloaded successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export CSV";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || loading}
      className={className}
      aria-label="Export CSV"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {loading ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
