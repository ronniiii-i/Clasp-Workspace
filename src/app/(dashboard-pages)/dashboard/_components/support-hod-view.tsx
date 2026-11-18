"use client";

import { Department, useDashboardData } from "../_hooks/use-dashboard-data";
import { DepartmentMetrics } from "./department_metrics";
import { MyTicketsWidget } from "./my-tickets-widget";
import { TeamPerformanceWidget } from "./team-performance-widget";
import { TaskProgress } from "./task-progress";
import { DashboardSkeleton } from "./skeleton";
import { DashboardEmpty, DashboardError } from "./dashboard-states";
import { ModuleShortcuts } from "./module-shortcut";

export function SupportHodDashboard() {
  const { data, isLoading, isError, error, refetch, isEmpty } =
    useDashboardData({
      scope: "department",
      department: Department.CUSTOMER_SUPPORT,
    });

  if (isLoading) return <DashboardSkeleton />;
  if (isError) {
    return (
      <DashboardError
        message={error?.message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!data || isEmpty) {
    return (
      <DashboardEmpty
        title="No support data available"
        description="Ticket and team widgets will appear here once tickets are recorded."
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customer Support Dashboard</h1>
      <ModuleShortcuts
        items={[
          { keywords: ["ticket"], label: "Tickets" },
          { keywords: ["task"], label: "Tasks" },
          { keywords: ["leave"], label: "Leave requests" },
        ]}
      />

      <DepartmentMetrics metrics={data.metrics} />

      <MyTicketsWidget tickets={data.tickets || []} title="Support Tickets" />

      <div className="grid gap-4 md:grid-cols-2">
        <TeamPerformanceWidget
          teams={data.teamMetrics || data.teamMetric || []}
          showIndividual={false}
        />
        <TaskProgress tasks={data.tasks || []} />
      </div>
    </div>
  );
}
