// Job board filters <-> URL query string <-> API params (same idea as searchParams.js).
// Pure, so it is unit tested with plain Node.

export const JOBS_PAGE_SIZE = 10;
export const MIN_JOB_QUERY_LENGTH = 2;

export const DEFAULT_JOB_FILTERS = Object.freeze({
  q: "",
  company: "",
  location: "",
  job_type: "",
  experience: "",
  skills: "",
  tab: "all", // "all" = job board, "mine" = my own jobs (open and closed)
});

const KEYS = ["q", "company", "location", "job_type", "experience", "skills"];
const VALID_TYPES = ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "FREELANCE"];

const clean = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

export function parsePage(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function urlToJobFilters(searchParams) {
  const filters = { ...DEFAULT_JOB_FILTERS };
  for (const key of KEYS) filters[key] = clean(searchParams.get(key));
  if (!VALID_TYPES.includes(filters.job_type)) filters.job_type = "";
  if (filters.experience !== "" && !/^\d{1,2}$/.test(filters.experience)) filters.experience = "";
  filters.tab = searchParams.get("tab") === "mine" ? "mine" : "all";
  return { filters, page: parsePage(searchParams.get("page")) };
}

export function jobFiltersToUrl(filters, page = 1) {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = clean(filters[key]);
    if (value) params.set(key, value);
  }
  if (filters.tab === "mine") params.set("tab", "mine");
  if (page > 1) params.set("page", String(page));
  return params;
}

// -> params for GET /api/jobs. A one-letter search is not sent (the server needs 2+ characters).
export function jobFiltersToApiParams(filters, page = 1, limit = JOBS_PAGE_SIZE) {
  const params = { page, limit };
  for (const key of KEYS) {
    const value = clean(filters[key]);
    if (!value) continue;
    if (key === "q" && value.length < MIN_JOB_QUERY_LENGTH) continue;
    params[key] = value;
  }
  if (filters.tab === "mine") params.mine = "true";
  return params;
}

export const activeJobFilterCount = (filters) =>
  ["company", "location", "job_type", "experience", "skills"].filter((k) => clean(filters[k])).length;

export const hasAnyJobCriteria = (filters) => Boolean(clean(filters.q)) || activeJobFilterCount(filters) > 0;

// clears the search box and refinements, keeps which tab you are on
export const clearJobFilters = (filters) => ({ ...DEFAULT_JOB_FILTERS, tab: filters.tab });
