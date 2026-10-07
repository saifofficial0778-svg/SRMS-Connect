import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getOverview, getPostStats, getProfileViewers } from "../../services/analyticsService";
import Avatar from "../../components/profile/Avatar";
import VerifiedBadge from "../../components/ui/VerifiedBadge";
import BarList from "../../components/insights/BarList";
import { InsightCard, InsightError, InsightSkeleton, InsightTabs } from "../../components/insights/InsightParts";
import TrendChart from "../../components/analytics/TrendChart";
import { timeAgo } from "../../components/feed/timeAgo";
import {
  CHART_METRICS,
  POST_SORTS,
  RANGE_OPTIONS,
  audienceRows,
  changeLabel,
  formatCount,
  formatRate,
  parseRange,
  parseSort,
  postPreview,
  roleLabel,
  viewerSubtitle,
  viewsLabel,
} from "../../utils/analyticsFormat";

const CHANGE_TONES = { up: "text-success-700", down: "text-danger-700", flat: "text-ink/55", none: "text-ink/45" };
const selectClass = "rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20";
const pagerButton = "rounded-lg border border-ink/15 bg-white px-3.5 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/5 disabled:opacity-40";

function MetricTile({ label, metric, secondary, days, definition }) {
  const change = changeLabel(metric, days);
  return (
    <div className="card px-5 py-4" title={definition}>
      <p className="text-sm font-medium text-ink/70">{label}</p>
      <p className="mt-1 text-3xl tabular-nums text-ink font-display">{formatCount(metric.value)}</p>
      <p className={`mt-1 text-xs ${CHANGE_TONES[change.tone]}`}>{change.text}</p>
      {secondary && <p className="mt-1 text-xs text-ink/55">{secondary}</p>}
    </div>
  );
}

function Pager({ pagination, onChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages } = pagination;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={pagerButton}>Previous</button>
      <span className="text-xs text-ink/55">Page {page} of {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={pagerButton}>Next</button>
    </nav>
  );
}

// loads one list and keeps showing the previous rows while the next page arrives
function useList(key, load) {
  const [state, setState] = useState({ key: null, status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ key, status: "success", data }))
      .catch(() => !cancelled && setState({ key, status: "error", data: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { status: state.key === key ? state.status : state.data ? "refreshing" : "loading", data: state.data };
}

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const days = parseRange(searchParams.get("days"));
  const sort = parseSort(searchParams.get("sort"));

  const [metricKey, setMetricKey] = useState(CHART_METRICS[0].key);
  const [postsPage, setPostsPage] = useState({ key: "", page: 1 });
  const [viewersPage, setViewersPage] = useState({ key: "", page: 1 });
  const [tick, setTick] = useState(0);

  // a page number only belongs to the range/sort it was chosen for
  const postsKey = `${days}|${sort}`;
  const postPage = postsPage.key === postsKey ? postsPage.page : 1;
  const viewerPage = viewersPage.key === String(days) ? viewersPage.page : 1;

  const overview = useList(`overview|${days}#${tick}`, () => getOverview(days));
  const posts = useList(`posts|${postsKey}|${postPage}#${tick}`, () => getPostStats({ days, sort }, postPage, 8));
  const viewers = useList(`viewers|${days}|${viewerPage}#${tick}`, () => getProfileViewers(days, viewerPage, 8));

  const setParam = (name, value, fallback) => {
    const next = new URLSearchParams(searchParams);
    if (String(value) === String(fallback)) next.delete(name);
    else next.set(name, String(value));
    setSearchParams(next, { replace: true });
  };

  // links from the profile card land on a section (#posts, #viewers, #search)
  const ready = overview.status === "success";
  useEffect(() => {
    if (ready && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ready, location.hash]);

  const data = overview.data;
  const metric = CHART_METRICS.find((m) => m.key === metricKey);
  const totals = data?.totals;
  const definitions = data?.definitions || {};
  const searcherRoles = audienceRows(data?.searchers.roles, roleLabel);
  const hasSearchDetail = data && (data.searchers.companies.length > 0 || data.searchers.designations.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-tight text-ink font-display sm:text-[28px]">Analytics</h1>
          <p className="mt-1 text-sm text-ink/60">How your posts and profile are doing. Only you can see this page.</p>
        </div>
        <InsightTabs />
      </header>

      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-sm text-ink/70">
          Period
          <select value={days} onChange={(e) => setParam("days", e.target.value, 30)} className={selectClass}>
            {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      </div>

      {overview.status === "loading" && <InsightSkeleton />}
      {overview.status === "error" && <InsightError onRetry={() => setTick((n) => n + 1)} />}

      {data && overview.status !== "error" && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricTile label="Post impressions" metric={totals.post_impressions} days={days} definition={definitions.post_impressions}
              secondary={`${formatCount(totals.post_reach.value)} ${totals.post_reach.value === 1 ? "person" : "people"} reached`} />
            <MetricTile label="Engagements" metric={totals.engagements} days={days} definition={definitions.engagements}
              secondary={`${totals.likes.value} likes · ${totals.comments.value} comments · ${formatRate(totals.engagement_rate)} rate`} />
            <MetricTile label="Profile views" metric={totals.profile_views} days={days} definition={definitions.profile_views}
              secondary={`${formatCount(totals.profile_viewers.value)} ${totals.profile_viewers.value === 1 ? "person" : "people"}`} />
            <MetricTile label="Search appearances" metric={totals.search_appearances} days={days} definition={definitions.search_appearances}
              secondary={`${formatCount(totals.searchers.value)} ${totals.searchers.value === 1 ? "searcher" : "searchers"}`} />
          </div>

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base text-ink font-display">{metric.label} per day</h2>
                <p className="mt-0.5 text-xs text-ink/50">{definitions[metric.key]}</p>
              </div>
              <div role="tablist" aria-label="Metric" className="inline-flex max-w-full overflow-x-auto scrollbar-none rounded-lg bg-ink/[0.06] p-1">
                {CHART_METRICS.map((m) => (
                  <button key={m.key} role="tab" aria-selected={m.key === metricKey} onClick={() => setMetricKey(m.key)}
                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${m.key === metricKey ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4"><TrendChart series={data.series} metric={metric} /></div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <div id="search" className="scroll-mt-24">
              <InsightCard
                title="Who found you in search"
                basis="People whose search or filtered directory results listed you. Shown as groups only: who searched is never revealed."
              >
                {totals.searchers.value === 0 ? (
                  <p className="py-6 text-center text-sm text-ink/45">You haven't appeared in anyone's search in this period. A complete profile with skills is easier to find.</p>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Searchers</h3>
                      <BarList rows={searcherRoles} unit="people" />
                    </div>
                    {data.searchers.companies.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Where alumni who found you work</h3>
                        <BarList rows={audienceRows(data.searchers.companies)} unit="people" />
                      </div>
                    )}
                    {data.searchers.designations.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">What they do</h3>
                        <BarList rows={audienceRows(data.searchers.designations)} unit="people" />
                      </div>
                    )}
                    {!hasSearchDetail && <p className="text-xs text-ink/50">Company and role details appear once alumni with a company on their profile find you.</p>}
                  </div>
                )}
              </InsightCard>
            </div>

            <div id="viewers" className="scroll-mt-24">
              <InsightCard title="Who viewed your profile" basis={definitions.profile_views}>
                {viewers.status === "loading" && <div className="h-40 skeleton" aria-busy="true" />}
                {viewers.status === "error" && <p className="py-6 text-center text-sm text-ink/55">Couldn't load viewers.</p>}
                {viewers.data && viewers.status !== "error" && (
                  viewers.data.viewers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink/45">Nobody has viewed your profile in this period.</p>
                  ) : (
                    <>
                      <ul className="divide-y divide-ink/8">
                        {viewers.data.viewers.map((v) => (
                          <li key={v.user_id}>
                            <Link to={`/profile/${v.user_id}`} className="flex items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-ink/[0.03]">
                              <span className="shrink-0"><Avatar photoUrl={v.profile_photo} fullName={v.full_name} size={40} /></span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">{v.full_name}{v.is_verified_alumni && <VerifiedBadge compact />}</span>
                                <span className="block truncate text-xs text-ink/55">{viewerSubtitle(v)}</span>
                              </span>
                              <span className="shrink-0 text-right text-xs text-ink/55">
                                <span className="block tabular-nums text-ink/80">{viewsLabel(v.views)}</span>
                                {timeAgo(v.last_viewed_at)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <Pager pagination={viewers.data.pagination} onChange={(page) => setViewersPage({ key: String(days), page })} />
                    </>
                  )
                )}
              </InsightCard>
            </div>
          </div>

          <section id="posts" className="scroll-mt-24 card p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base text-ink font-display">Your posts</h2>
                <p className="mt-0.5 text-xs text-ink/50">Impressions and people reached are since each post was published. Engagement rate is likes plus comments, divided by impressions.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink/70">
                Sort
                <select value={sort} onChange={(e) => setParam("sort", e.target.value, "recent")} className={selectClass}>
                  {POST_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {posts.status === "loading" && <div className="mt-4 h-40 skeleton" aria-busy="true" />}
            {posts.status === "error" && <p className="py-8 text-center text-sm text-ink/55">Couldn't load your posts.</p>}
            {posts.data && posts.status !== "error" && (
              posts.data.posts.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink/45">
                  You haven't posted yet. <Link to="/home" className="font-medium text-accent-700 hover:text-accent-800">Share something</Link> to see how it performs.
                </p>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="text-xs text-ink/55">
                        <tr className="border-b border-ink/10">
                          <th className="py-2 pr-3 text-left font-medium">Post</th>
                          <th className="px-3 py-2 text-right font-medium">Impressions</th>
                          <th className="px-3 py-2 text-right font-medium">Reached</th>
                          <th className="px-3 py-2 text-right font-medium">Likes</th>
                          <th className="px-3 py-2 text-right font-medium">Comments</th>
                          <th className="py-2 pl-3 text-right font-medium">Engagement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.data.posts.map((post) => (
                          <tr key={post.id} className="border-b border-ink/8 last:border-0">
                            <td className="max-w-xs py-3 pr-3">
                              <p className="line-clamp-2 text-ink">{postPreview(post)}</p>
                              <p className="mt-0.5 text-xs text-ink/45">
                                {timeAgo(post.created_at)}
                                {post.period_impressions > 0 && <> · {formatCount(post.period_impressions)} in this period</>}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums font-semibold text-ink">{formatCount(post.impressions)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink/80">{formatCount(post.reach)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink/80">{post.likes}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink/80">{post.comments}</td>
                            <td className="py-3 pl-3 text-right tabular-nums text-ink/80">{formatRate(post.engagement_rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager pagination={posts.data.pagination} onChange={(page) => setPostsPage({ key: postsKey, page })} />
                </>
              )
            )}
          </section>

          <p className="rounded-lg bg-ink/[0.04] px-4 py-3 text-xs leading-relaxed text-ink/60">
            <span className="font-semibold text-ink/75">About these numbers. </span>
            Counted from activity on SRMS Connect since analytics was switched on. Your own views of your posts and profile are never counted,
            and neither are admins. A post counts as seen once at least half of it has been on someone's screen for a second.
          </p>
        </>
      )}
    </div>
  );
}
