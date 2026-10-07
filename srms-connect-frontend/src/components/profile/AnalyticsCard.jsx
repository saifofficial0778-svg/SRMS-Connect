import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOverview } from "../../services/analyticsService";
import { formatCount } from "../../utils/analyticsFormat";

const DAYS = 30;

// The private "Analytics" strip on your own profile: three numbers, each a way into the full page.
export default function AnalyticsCard() {
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getOverview(DAYS)
      .then((data) => !cancelled && setTotals(data.totals))
      .catch(() => {}); // the card simply stays hidden if the numbers can't be loaded
    return () => {
      cancelled = true;
    };
  }, []);

  if (!totals) return null;

  const items = [
    { to: "/analytics#viewers", value: totals.profile_viewers.value, label: "profile viewers", hint: "See who viewed your profile" },
    { to: "/analytics#posts", value: totals.post_impressions.value, label: "post impressions", hint: "See how your posts are doing" },
    { to: "/analytics#search", value: totals.search_appearances.value, label: "search appearances", hint: "See how often you were found" },
  ];

  return (
    <section aria-label="Your analytics" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base text-ink font-display">Analytics</h2>
        <p className="text-xs text-ink/50">Private to you · last {DAYS} days</p>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.label}>
            <Link to={item.to} className="block rounded-lg border border-ink/8 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand-50/50">
              <p className="text-2xl tabular-nums text-ink font-display">{formatCount(item.value)}</p>
              <p className="text-sm font-medium text-ink/80">{item.label}</p>
              <p className="mt-0.5 text-xs text-ink/50">{item.hint}</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-right">
        <Link to="/analytics" className="text-sm font-medium text-accent-700 hover:text-accent-800">Show all analytics</Link>
      </div>
    </section>
  );
}
