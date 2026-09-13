function StatBlock({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xl font-semibold text-[#1B2438]">{value}</span>
      <span className="text-sm text-[#1B2438]/60">{label}</span>
    </div>
  );
}

export default function NetworkStats({ connections, received, sent }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
      <StatBlock label="Connections" value={connections} />
      <StatBlock label="Requests received" value={received} />
      <StatBlock label="Sent" value={sent} />
    </div>
  );
}