function Bar({ w = "w-full", h = "h-4" }) {
  return <div className={`${w} ${h} rounded bg-[#1B2438]/8 animate-pulse`} />;
}

export default function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="rounded-2xl border border-[#1B2438]/10 bg-white overflow-hidden">
        <div className="h-24 bg-[#1B2438]/10 animate-pulse" />
        <div className="px-8 pb-8 -mt-12">
          <div className="h-28 w-28 rounded-full bg-[#1B2438]/15 ring-4 ring-white animate-pulse" />
          <div className="mt-4 space-y-2 max-w-sm">
            <Bar w="w-40" h="h-6" />
            <Bar w="w-56" />
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 space-y-3">
          <Bar w="w-32" h="h-5" />
          <Bar />
          <Bar w="w-3/4" />
          <Bar w="w-1/2" />
        </div>
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-6 space-y-3">
          <Bar w="w-32" h="h-5" />
          <Bar />
          <Bar w="w-2/3" />
        </div>
      </div>
    </div>
  );
}
