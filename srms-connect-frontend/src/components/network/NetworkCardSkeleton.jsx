export function NetworkCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#1B2438]/10 p-5 flex items-center gap-4 animate-pulse">
      <div className="h-14 w-14 rounded-full bg-[#1B2438]/10 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-[#1B2438]/10" />
        <div className="h-3 w-1/2 rounded bg-[#1B2438]/8" />
      </div>
    </div>
  );
}