const TABS = [
  { key: "connections", label: "Connections" },
  { key: "received", label: "Requests" },
  { key: "sent", label: "Sent" },
];

export default function NetworkTabs({ active, onChange, counts }) {
  return (
    <div className="flex gap-1 border-b border-[#1B2438]/10 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? "text-[#1B2438]" : "text-[#1B2438]/50 hover:text-[#1B2438]/80"
            }`}
          >
            {tab.label}
            {typeof count === "number" && count > 0 && (
              <span className="ml-1.5 text-xs text-[#C98A2B]">{count}</span>
            )}
            {isActive && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#C98A2B] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}