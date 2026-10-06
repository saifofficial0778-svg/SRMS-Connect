// Industry Pulse + My Skill Gap: number formatting, bar geometry, trend wording, filters.
// Pure (no React / axios / router imports) so it is unit tested with plain Node.
// Nothing here invents data: every helper only formats numbers the API returned.

import { JOB_TYPES } from "./jobFormat.js";

// 66.7 -> "66.7%", 50 -> "50%"
export function formatShare(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

export const pluralize = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// Width of a bar as a percentage of the largest value in its list. A non-zero value always gets
// a visible sliver so "1" never looks like "0".
export function barWidth(value, max) {
  const v = Number(value) || 0;
  const m = Number(max) || 0;
  if (v <= 0 || m <= 0) return 0;
  return Math.max(3, Math.min(100, Math.round((v / m) * 100)));
}

// items -> rows for <BarList>: { key, label, value, width, detail }
export function toBarRows(items, { label, value, detail, key } = {}) {
  const list = items || [];
  const max = list.reduce((m, item) => Math.max(m, Number(item[value]) || 0), 0);
  return list.map((item, index) => ({
    key: key ? item[key] : `${item[label]}-${index}`,
    label: item[label],
    value: Number(item[value]) || 0,
    width: barWidth(item[value], max),
    detail: typeof detail === "function" ? detail(item) : "",
  }));
}

// Trend of a skill in job posts: wording + a symbol, so direction is never shown by colour alone.
export function trendLabel({ recent = 0, previous = 0, direction } = {}) {
  const change = recent - previous;
  switch (direction) {
    case "new":
      return { symbol: "★", text: "New this period", tone: "up" };
    case "up":
      return { symbol: "▲", text: `${change} more than before`, tone: "up" };
    case "down":
      return { symbol: "▼", text: `${Math.abs(change)} fewer than before`, tone: "down" };
    default:
      return { symbol: "–", text: "No change", tone: "flat" };
  }
}

export const jobTypeName = (value) => JOB_TYPES.find((t) => t.value === value)?.label || value || "";

// ======================= Skill gap =======================

export const DEFAULT_GAP_FILTERS = Object.freeze({ job_type: "", role: "" });
export const MIN_ROLE_LENGTH = 2;

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const VALID_TYPES = JOB_TYPES.map((t) => t.value);

export function urlToGapFilters(searchParams) {
  const jobType = clean(searchParams.get("job_type"));
  return {
    job_type: VALID_TYPES.includes(jobType) ? jobType : "",
    role: clean(searchParams.get("role")),
  };
}

export function gapFiltersToUrl(filters) {
  const params = new URLSearchParams();
  if (filters.job_type) params.set("job_type", filters.job_type);
  if (clean(filters.role)) params.set("role", clean(filters.role));
  return params;
}

// a one-letter role is not sent (the server needs 2+ characters)
export function gapFiltersToApiParams(filters) {
  const params = {};
  if (filters.job_type) params.job_type = filters.job_type;
  const role = clean(filters.role);
  if (role.length >= MIN_ROLE_LENGTH) params.role = role;
  return params;
}

export const hasGapFilters = (filters) => Boolean(filters.job_type || clean(filters.role));

// Which explanation to show instead of (or above) the ranked list.
//   no-jobs         nothing is listed (for these filters)
//   no-job-skills   jobs exist but none of them lists skills
//   no-profile-skills  the viewer has not added any skills yet (the list is still shown)
//   all-matched     every demanded skill is already on the profile
//   ok              there are gaps to show
export function gapState(report) {
  const s = report?.summary;
  if (!s || s.jobs_considered === 0) return "no-jobs";
  if (s.jobs_with_skills === 0) return "no-job-skills";
  if (s.your_skills === 0) return "no-profile-skills";
  if (s.missing_skills === 0) return "all-matched";
  return "ok";
}

// "You already meet 3 of the 9 skill requirements across 3 jobs (33.3%)."
export function coverageSentence(summary) {
  if (!summary || summary.requirements_total === 0) return "";
  return `You already meet ${summary.requirements_met} of the ${summary.requirements_total} skill requirements across ${pluralize(
    summary.jobs_with_skills,
    "job"
  )} (${formatShare(summary.coverage_percent)}).`;
}

// "Asked for by 2 of 3 jobs (66.7%)"
export function demandSentence(entry, summary) {
  return `Asked for by ${entry.jobs_requiring} of ${pluralize(summary.jobs_with_skills, "job")} (${formatShare(entry.share_of_jobs)})`;
}

export const alumniSentence = (count) =>
  count > 0 ? `${pluralize(count, "alumnus", "alumni")} on SRMS Connect ${count === 1 ? "lists" : "list"} it` : "No alumni list it yet";
