"use client";

import { TrashTable } from "@/components/departments/TrashTable";

/**
 * Tenant-admin recovery surface for soft-deleted business records.
 *
 * The settings layout already enforces the administrator guard.
 */
export default function SettingsTrashPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Trash</h2>
        <p className="text-sm text-muted-foreground">
          Review soft-deleted records, restore them, or purge them permanently.
          Restores and purges are recorded in the audit log.
        </p>
      </div>
      <TrashTable />
    </div>
  );
}
