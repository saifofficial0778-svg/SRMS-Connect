// Ranked horizontal bars for "how many" data (skills, companies, roles).
//
// One series, so one hue and no legend: the card title says what is counted. Every bar carries
// its number in text at the tip, so the chart reads without relying on colour or bar length alone,
// and the list doubles as its own data table. Bars are thin, grow from a single left baseline,
// and are rounded only at the data end.
export default function BarList({ rows, unit = "", emptyText = "No data yet." }) {
  if (!rows || rows.length === 0) {
    return <p className="py-6 text-center text-sm text-[#1B2438]/45">{emptyText}</p>;
  }

  return (
    <ol className="space-y-2.5">
      {rows.map((row, index) => (
        <li
          key={row.key}
          title={`${row.label}: ${row.value}${unit ? ` ${unit}` : ""}${row.detail ? ` (${row.detail})` : ""}`}
          className="group rounded-md px-1 py-0.5 hover:bg-[#1B2438]/[0.03]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-[#1B2438]">
              <span className="mr-1.5 tabular-nums text-xs text-[#1B2438]/40">{index + 1}.</span>
              {row.label}
            </span>
            {/* values stay in text ink, never the bar colour */}
            <span className="shrink-0 text-sm tabular-nums text-[#1B2438]/80">
              <span className="font-semibold text-[#1B2438]">{row.value}</span>
              {row.detail && <span className="ml-1.5 text-xs text-[#1B2438]/50">{row.detail}</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full" aria-hidden="true">
            <div className="h-full rounded-r bg-[#C98A2B] group-hover:bg-[#B37A22]" style={{ width: `${row.width}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
