import { RendererSkeleton } from "@/components/renderers/shared/RendererSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Type-aware module skeleton with a breadcrumb, shown instantly on navigation. */
export default function ModuleLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading module">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Skeleton className="h-3 w-16" />
        <span aria-hidden="true">/</span>
        <Skeleton className="h-3 w-24" />
        <span aria-hidden="true">/</span>
        <Skeleton className="h-3 w-32" />
      </div>
      <RendererSkeleton />
    </div>
  );
}
