import { Info } from "lucide-react";
import { ErrorState, SectionHeader, Skeleton, StatCard, Tabs } from "../ui/Primitives";

// The insight pages were written against these names; they are now thin layers over the shared
// design-system components.

export function StatTile({ value, label, hint }) {
  return <StatCard value={value} label={label} hint={hint} />;
}

// Card with a title and a line saying exactly what is being counted.
export function InsightCard({ title, basis, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <SectionHeader title={title} description={basis} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

// one place for everything "numbers": platform-wide insights and the member's own analytics
export function InsightTabs() {
  return (
    <Tabs
      label="Insights"
      tabs={[
        { to: "/industry-pulse", label: "Industry Pulse" },
        { to: "/skill-gap", label: "My Skill Gap" },
        { to: "/analytics", label: "My Analytics" },
      ]}
    />
  );
}

// states the source of the numbers on every insight page
export function DataSourceNote({ text, generatedAt }) {
  if (!text) return null;
  return (
    <p className="flex items-start gap-2.5 rounded-lg border border-ink/8 bg-white px-4 py-3 text-[13px] leading-relaxed text-ink/60">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.9} aria-hidden="true" />
      <span>
        <span className="font-semibold text-ink/80">About these numbers. </span>
        {text}
        {generatedAt && <span> Updated {new Date(generatedAt).toLocaleString()}.</span>}
      </span>
    </p>
  );
}

export function InsightSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 !rounded-xl" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 !rounded-xl" />)}
      </div>
    </div>
  );
}

export function InsightError({ onRetry }) {
  return <ErrorState title="Couldn't load this page" onRetry={onRetry} />;
}
