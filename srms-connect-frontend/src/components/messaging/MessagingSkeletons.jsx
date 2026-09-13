function Bar({ w = "w-full", h = "h-3" }) {
  return <div className={`${w} ${h} rounded bg-[#1B2438]/8 animate-pulse`} />;
}

export function ConversationListSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-3">
          <div className="h-11 w-11 rounded-full bg-[#1B2438]/8 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <Bar w="w-24" />
            <Bar w="w-36" h="h-2.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex justify-start">
        <div className="max-w-[60%] space-y-2">
          <Bar w="w-40" h="h-8" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="max-w-[55%] space-y-2">
          <Bar w="w-32" h="h-8" />
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[45%] space-y-2">
          <Bar w="w-24" h="h-8" />
        </div>
      </div>
    </div>
  );
}
