// Ranked horizontal bars for "how many" data (skills, companies, roles).
//
// One series, so one hue and no legend: the card title says what is counted. Every bar carries
// its number in text at the tip, so the chart reads without relying on colour or bar length alone,
// and the list doubles as its own data table. Bars are thin, grow from a single left baseline,
// and are rounded only at the data end.
export default function BarList({ rows, unit = "", emptyText = "No data yet." }) {
  if (!rows || rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/45">{emptyText}</p>;
  }

  return (
    <ol className="space-y-2.5">
      {rows.map((row, index) => (
        <li
          key={row.key}
          title={`${row.label}: ${row.value}${unit ? ` ${unit}` : ""}${row.detail ? ` (${row.detail})` : ""}`}
          className="group rounded-md px-1 py-0.5 hover:bg-ink/[0.03]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink">
              <span className="mr-1.5 tabular-nums text-xs text-ink/40">{index + 1}.</span>
              {row.label}
            </span>
            {/* values stay in text ink, never the bar colour */}
            <span className="shrink-0 text-sm tabular-nums text-ink/80">
              <span className="font-semibold text-ink">{row.value}</span>
              {row.detail && <span className="ml-1.5 text-xs text-ink/50">{row.detail}</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full" aria-hidden="true">
            <div className="h-full rounded-r bg-accent group-hover:bg-accent-600" style={{ width: `${row.width}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
