// src/app/(dashboard-pages)/dashboard/_components/department-metrics.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metric } from "../types";
import { getIconComponent } from "@/lib/modules";
import { keywordsFromTitle, useModulePathFor } from "./module-shortcut";

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = getIconComponent(metric.icon);
  const href = useModulePathFor(keywordsFromTitle(metric.title));
  const card = (
    <Card
      className={
        href
          ? "h-full transition-colors hover:border-ring focus-within:border-ring"
          : "h-full"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metric.value}</div>
        <p className="text-xs text-muted-foreground">
          {metric.change} from last period
        </p>
      </CardContent>
    </Card>
  );

  if (!href) return card;
  return (
    <Link
      href={href}
      prefetch
      aria-label={`Open module for ${metric.title}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </Link>
  );
}

export function DepartmentMetrics({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
