import { Skeleton } from "../ui/Primitives";

export function NetworkCardSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-12 shrink-0 !rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
