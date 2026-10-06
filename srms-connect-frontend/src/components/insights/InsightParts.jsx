import { NavLink } from "react-router-dom";

// A single headline number: a stat tile, not a one-bar chart.
export function StatTile({ value, label, hint }) {
  return (
    <div className="rounded-2xl border border-[#1B2438]/10 bg-white px-5 py-4">
      <p className="text-3xl tabular-nums text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-[#1B2438]/75">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-[#1B2438]/45">{hint}</p>}
    </div>
  );
}

// Card with a title and a line saying exactly what is being counted.
export function InsightCard({ title, basis, children }) {
  return (
    <section className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 sm:p-6">
      <h2 className="text-lg text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
        {title}
      </h2>
      {basis && <p className="mt-1 text-xs text-[#1B2438]/50">{basis}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const tabClass = ({ isActive }) =>
  `rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-white text-[#1B2438] shadow-sm" : "text-[#1B2438]/55 hover:text-[#1B2438]"
  }`;

// switch between the two insight pages
export function InsightTabs() {
  return (
    <nav aria-label="Insights" className="inline-flex rounded-lg bg-[#1B2438]/5 p-1">
      <NavLink to="/industry-pulse" className={tabClass}>Industry Pulse</NavLink>
      <NavLink to="/skill-gap" className={tabClass}>My Skill Gap</NavLink>
    </nav>
  );
}

// states the source of the numbers on every insight page
export function DataSourceNote({ text, generatedAt }) {
  if (!text) return null;
  return (
    <p className="rounded-xl bg-[#1B2438]/[0.04] px-4 py-3 text-xs leading-relaxed text-[#1B2438]/60">
      <span className="font-semibold text-[#1B2438]/75">About these numbers. </span>
      {text}
      {generatedAt && <span> Updated {new Date(generatedAt).toLocaleString()}.</span>}
    </p>
  );
}

export function InsightSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[#1B2438]/[0.06]" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-[#1B2438]/[0.06]" />)}
      </div>
    </div>
  );
}

export function InsightError({ onRetry }) {
  return (
    <div className="rounded-2xl border border-[#1B2438]/10 bg-white py-14 text-center">
      <p className="font-medium text-[#1B2438]">Couldn't load this page.</p>
      <button onClick={onRetry} className="mt-4 rounded-lg bg-[#1B2438] px-4 py-2 text-sm text-white hover:bg-[#141B2C]">
        Try again
      </button>
    </div>
  );
}
