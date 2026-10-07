import { useMemo, useState } from "react";
import { chartGeometry, formatCount, shortDate } from "../../utils/analyticsFormat";

// One daily series as a line. A single series needs no legend (the card title names it), the
// y-axis always starts at zero, and every value is reachable without colour: hover or focus a
// day for its number, or open the table underneath.
export default function TrendChart({ series, metric }) {
  const [active, setActive] = useState(null);
  const g = useMemo(() => chartGeometry(series, metric.key), [series, metric.key]);
  const point = active !== null ? g.points[active] : null;

  if (g.points.length === 0) return <p className="py-10 text-center text-sm text-ink/45">No data for this period.</p>;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${g.width} ${g.height}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${metric.label} per day: ${formatCount(g.total)} in total, highest day ${formatCount(Math.max(...g.points.map((p) => p.value)))}`}
          onMouseLeave={() => setActive(null)}
        >
          {/* recessive grid and axis labels */}
          {g.yTicks.map((tick) => (
            <g key={tick.value}>
              <line x1={g.left} x2={g.width - g.right} y1={tick.y} y2={tick.y} stroke="#1B2438" strokeOpacity={tick.value === 0 ? 0.25 : 0.08} strokeWidth="1" />
              <text x={g.left - 8} y={tick.y + 4} textAnchor="end" fontSize="11" fill="#1B2438" fillOpacity="0.5">{formatCount(tick.value)}</text>
            </g>
          ))}
          {g.xLabels.map((p) => (
            <text key={p.date} x={p.x} y={g.height - 8} textAnchor="middle" fontSize="11" fill="#1B2438" fillOpacity="0.5">{shortDate(p.date)}</text>
          ))}

          <path d={g.area} fill="#C98A2B" fillOpacity="0.12" />
          <path d={g.line} fill="none" stroke="#9F6C1E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {point && (
            <>
              <line x1={point.x} x2={point.x} y1={g.top} y2={g.baseline} stroke="#1B2438" strokeOpacity="0.25" strokeWidth="1" />
              <circle cx={point.x} cy={point.y} r="5" fill="#9F6C1E" stroke="#fff" strokeWidth="2" />
            </>
          )}

          {/* one generous hit column per day, so the pointer never has to find the line itself */}
          {g.points.map((p, i) => (
            <rect
              key={p.date}
              x={p.x - g.columnWidth / 2}
              y={g.top}
              width={g.columnWidth}
              height={g.baseline - g.top}
              fill="transparent"
              tabIndex={0}
              aria-label={`${shortDate(p.date)}: ${p.value} ${metric.unit}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              style={{ outline: "none" }}
            />
          ))}
        </svg>

        {point && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-raised whitespace-nowrap"
            style={{ left: `${Math.min(88, Math.max(12, (point.x / g.width) * 100))}%`, top: `${(point.y / g.height) * 100}%`, marginTop: -10 }}
          >
            <span className="font-semibold tabular-nums">{formatCount(point.value)}</span> {metric.unit} · {shortDate(point.date)}
          </div>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-ink/55 hover:text-ink">Show as a table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-ink/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-canvas text-xs text-ink/60">
              <tr><th className="px-3 py-1.5 text-left font-medium">Day</th><th className="px-3 py-1.5 text-right font-medium">{metric.label}</th></tr>
            </thead>
            <tbody>
              {[...g.points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-ink/8">
                  <td className="px-3 py-1.5 text-ink/75">{shortDate(p.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
