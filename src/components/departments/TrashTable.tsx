"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  Inbox,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTrash,
  purgeTrash,
  restoreTrash,
  type TrashItem,
  type TrashResult,
} from "@/services/departments";
import {
  formatTimestamp,
  humanizeKey,
} from "@/components/renderers/shared/record-utils";
import { cn } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  attendance_records: "Attendance",
  contacts: "Contacts",
  deals: "Deals",
  documents: "Documents",
  expenses: "Expenses",
  inventory_items: "Inventory",
  invoices: "Invoices",
  leave_requests: "Leave requests",
  projects: "Projects",
  support_tickets: "Support tickets",
  tasks: "Tasks",
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? humanizeKey(entity);
}

export interface TrashTableProps {
  /** Pre-select one allowlisted entity key. */
  initialEntity?: string;
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
  onTotalChange?: (total: number) => void;
}

/**
 * Tenant-admin recovery table for soft-deleted business records.
 *
 * The backend exposes a tenant-wide list, per-entity counts and the original
 * module path; restore and purge are audited server-side.
 */
export function TrashTable({
  initialEntity,
  pageSize = 25,
  className,
  emptyMessage = "Trash is empty. No deleted records found.",
  onTotalChange,
}: TrashTableProps) {
  const [entity, setEntity] = useState(initialEntity ?? "");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TrashResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const totalChangeRef = useRef(onTotalChange);

  useEffect(() => {
    totalChangeRef.current = onTotalChange;
  }, [onTotalChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getTrash({
        entity: entity || undefined,
        q: search || undefined,
        page,
        pageSize,
      });
      setResult(next);
      totalChangeRef.current?.(next.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trash.");
    } finally {
      setLoading(false);
    }
  }, [entity, page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => result?.counts ?? {}, [result]);
  const total = result?.meta.total ?? 0;
  const allTotal = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  const entities = useMemo(
    () =>
      Object.keys(counts)
        .filter((key) => (counts[key] ?? 0) > 0)
        .sort((a, b) => entityLabel(a).localeCompare(entityLabel(b))),
    [counts],
  );

  const changeEntity = (next: string) => {
    setEntity(next);
    setPage(1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleRestore = async (item: TrashItem) => {
    const key = `${item.entity}-${item.id}`;
    setBusy(key);
    try {
      await restoreTrash(item.entity, item.id);
      toast.success(`Restored “${item.label}”.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore record.");
    } finally {
      setBusy(null);
    }
  };

  const handlePurge = async (item: TrashItem) => {
    if (
      !window.confirm(
        `Permanently delete “${item.label}”? This cannot be undone.`,
      )
    ) {
      return;
    }

    const key = `${item.entity}-${item.id}`;
    setBusy(key);
    try {
      await purgeTrash(item.entity, item.id);
      toast.success("Record permanently deleted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to purge record.");
    } finally {
      setBusy(null);
    }
  };

  const rows = result?.data ?? [];

  return (
    <section className={cn("flex flex-col gap-4", className)} aria-label="Trash">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search deleted records…"
            aria-label="Search deleted records"
            className="pl-8"
          />
        </form>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw
            className={cn("size-4", loading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={entity === "" ? "default" : "outline"}
          size="sm"
          onClick={() => changeEntity("")}
        >
          All
          <Badge variant="secondary" className="ml-1.5">
            {allTotal}
          </Badge>
        </Button>
        {entities.map((key) => (
          <Button
            key={key}
            type="button"
            variant={entity === key ? "default" : "outline"}
            size="sm"
            onClick={() => changeEntity(key)}
          >
            {entityLabel(key)}
            <Badge variant="secondary" className="ml-1.5">
              {counts[key] ?? 0}
            </Badge>
          </Button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Module</TableHead>
                <TableHead className="hidden md:table-cell">Deleted</TableHead>
                <TableHead className="hidden lg:table-cell">Deleted by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const key = `${item.entity}-${item.id}`;
                const rowBusy = busy === key;
                return (
                  <TableRow key={key} data-testid="trash-row">
                    <TableCell className="max-w-56 truncate font-medium">
                      {item.label}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entityLabel(item.entity)}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs">
                      {item.modulePath ? (
                        <Link
                          href={item.modulePath}
                          className="text-primary hover:underline"
                        >
                          {item.modulePath}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {item.deletedAt ? formatTimestamp(item.deletedAt) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {item.deletedBy?.name ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() => void handleRestore(item)}
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          Restore
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() => void handlePurge(item)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Purge
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {result
            ? `${total} record${total === 1 ? "" : "s"} · page ${result.meta.page} of ${result.meta.totalPages}`
            : loading
              ? "Loading…"
              : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !result || page >= result.meta.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
