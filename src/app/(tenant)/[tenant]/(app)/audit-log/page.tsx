"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModuleHost } from "@/components/renderers/ModuleHost";
import { useAuthStore } from "@/stores/auth-store";
import { isTenantAdminRole } from "@/lib/format";

/**
 * Tenant-admin audit log.
 *
 * The module is provisioned as a global (departmentless) module, so it is
 * served under the reserved `workspace` pseudo-department key.
 */
export default function AuditLogPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const isTenantAdmin = isTenantAdminRole(
    user?.role as unknown as { isTenantAdmin?: boolean; slug?: string } | string,
  );

  // The sidebar hides this link for everyone else, but a direct visit must not
  // render tenant-wide audit data.
  useEffect(() => {
    if (isLoading || !user) return;
    if (isTenantAdmin) return;
    toast.error("The audit log is only available to tenant administrators.");
    router.replace("/dashboard");
  }, [isLoading, isTenantAdmin, router, user]);

  if (isLoading || !user || !isTenantAdmin) return null;

  return <ModuleHost deptKey="workspace" moduleKey="audit-log" />;
}
