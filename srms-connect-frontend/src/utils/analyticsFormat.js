// Personal analytics: labels, number formatting, chart geometry and the impression batcher.
// Pure (no React / axios / router imports) so it is unit tested with plain Node.

export const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];
export const DEFAULT_RANGE = 30;

// anything that is not one of the offered ranges falls back to the default
export function parseRange(value) {
  const n = Number(value);
  return RANGE_OPTIONS.some((r) => r.value === n) ? n : DEFAULT_RANGE;
}

export const POST_SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "impressions", label: "Most impressions" },
];
export const parseSort = (value) => (POST_SORTS.some((s) => s.value === value) ? value : "recent");

// the three daily series the chart can show, one at a time (they are different units of attention,
// so they never share an axis)
export const CHART_METRICS = [
  { key: "post_impressions", label: "Post impressions", unit: "impressions" },
  { key: "profile_views", label: "Profile views", unit: "views" },
  { key: "search_appearances", label: "Search appearances", unit: "appearances" },
];

// 1234 -> "1,234", 15300 -> "15.3K", 2400000 -> "2.4M"
export function formatCount(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-IN");
}

export const formatRate = (percent) => `${Number(percent) || 0}%`;

// How a number moved against the previous period. The arrow carries the direction, so it never
// depends on colour alone; "tone" only picks the colour that supports it.
export function changeLabel(metric, days) {
  const period = `previous ${days} days`;
  if (!metric) return { text: "", tone: "none" };
  if (metric.change_percent === null || metric.change_percent === undefined) {
    return metric.value > 0 ? { text: `New — nothing in the ${period}`, tone: "up" } : { text: `No activity in this or the ${period}`, tone: "none" };
  }
  if (metric.change_percent === 0) return { text: `No change vs ${period}`, tone: "flat" };
  const up = metric.change_percent > 0;
  return { text: `${up ? "▲" : "▼"} ${Math.abs(metric.change_percent)}% vs ${period}`, tone: up ? "up" : "down" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-10-04" -> "4 Oct" (parsed by hand: new Date("YYYY-MM-DD") would shift across time zones)
export function shortDate(day) {
  const [, month, date] = String(day || "").split("-").map(Number);
  return month && date ? `${date} ${MONTHS[month - 1]}` : "";
}

// a round number at or above the largest value, so gridlines land on readable values
export function niceMax(value) {
  const n = Number(value) || 0;
  if (n <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 4, 5, 10]) if (n <= step * magnitude) return step * magnitude;
  return 10 * magnitude;
}

// Everything the line chart needs, in SVG user units. Kept pure so the maths is testable.
export function chartGeometry(series, key, { width = 720, height = 240, left = 44, right = 16, top = 16, bottom = 28 } = {}) {
  const list = series || [];
  const max = niceMax(list.reduce((m, point) => Math.max(m, Number(point[key]) || 0), 0));
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const baseline = top + innerHeight;
  const xAt = (i) => left + (list.length <= 1 ? innerWidth / 2 : (i / (list.length - 1)) * innerWidth);
  const yAt = (value) => top + innerHeight - (value / max) * innerHeight;

  const points = list.map((point, i) => ({ x: xAt(i), y: yAt(Number(point[key]) || 0), value: Number(point[key]) || 0, date: point.date }));
  const round = (n) => Math.round(n * 10) / 10;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`).join(" ");
  const area = points.length ? `${line} L${round(points[points.length - 1].x)},${baseline} L${round(points[0].x)},${baseline} Z` : "";

  // at most ~6 date labels, always the first and the last day; one too close to the last is dropped
  const every = Math.max(1, Math.ceil(points.length / 6));
  const last = points[points.length - 1];
  const xLabels = points.filter((p, i) => p === last || (i % every === 0 && last.x - p.x > 40));

  return {
    width, height, left, right, top, baseline, max, points, line, area,
    yTicks: [0, max / 2, max].map((value) => ({ value, y: yAt(value) })),
    xLabels,
    columnWidth: list.length > 1 ? innerWidth / (list.length - 1) : innerWidth,
    total: points.reduce((sum, p) => sum + p.value, 0),
  };
}

const ROLE_LABELS = { STUDENT: "Students", ALUMNI: "Alumni", ADMIN: "Admins" };
export const roleLabel = (role) => ROLE_LABELS[role] || role || "";
const ROLE_SINGULAR = { STUDENT: "Student", ALUMNI: "Alumnus" };

// audience groups -> rows for the shared BarList
export function audienceRows(items, labelOf = (label) => label) {
  const list = items || [];
  const max = list.reduce((m, item) => Math.max(m, Number(item.people) || 0), 0);
  return list.map((item, index) => ({
    key: `${item.label}-${index}`,
    label: labelOf(item.label),
    value: Number(item.people) || 0,
    width: max > 0 ? Math.max(4, Math.round(((Number(item.people) || 0) / max) * 100)) : 0,
    detail: "",
  }));
}

export function postPreview(post, max = 110) {
  const text = String(post?.content || "").replace(/\s+/g, " ").trim();
  if (!text) return post?.media_count ? `Post with ${post.media_count} ${post.media_count === 1 ? "attachment" : "attachments"}` : "Post";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function viewerSubtitle(viewer) {
  const work = [viewer.designation, viewer.company].filter(Boolean).join(" at ");
  if (viewer.role === "ALUMNI" && work) return work;
  return [ROLE_SINGULAR[viewer.role] || "", viewer.branch, viewer.batch_year && `Batch ${viewer.batch_year}`].filter(Boolean).join(" · ");
}

export const viewsLabel = (count) => `${count} ${count === 1 ? "view" : "views"}`;

// the one-line summary under the author's own post
export function postStatsLine(analytics) {
  if (!analytics) return "";
  const { impressions = 0, reach = 0 } = analytics;
  if (impressions === 0) return "No impressions yet";
  return `${formatCount(impressions)} ${impressions === 1 ? "impression" : "impressions"} · ${formatCount(reach)} ${reach === 1 ? "person" : "people"} reached`;
}

// ======================= impression batching =======================

// Collects "this post was on screen" events and sends them in small batches.
// A post is reported once per page session; a failed batch is forgotten so it can be reported
// again later. Timers are injected so this can be tested without waiting.
export function createImpressionTracker({ send, delayMs = 2000, maxBatch = 25, schedule = setTimeout, cancel = clearTimeout }) {
  const reported = new Set();
  let queue = [];
  let timer = null;

  async function flush() {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    try {
      await send(batch);
    } catch {
      for (const id of batch) reported.delete(id);
    }
  }

  function seen(postId) {
    const id = Number(postId);
    if (!Number.isInteger(id) || id < 1 || reported.has(id)) return false;
    reported.add(id);
    queue.push(id);
    if (queue.length >= maxBatch) flush();
    else if (timer === null) timer = schedule(flush, delayMs);
    return true;
  }

  return { seen, flush, pending: () => queue.length, reset: () => { reported.clear(); queue = []; } };
}
