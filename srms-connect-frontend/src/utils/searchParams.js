// Pure helpers for the Alumni Directory filters: state <-> URL query string <-> API params.
// No React / axios imports, so they are unit tested with plain Node.

export const PAGE_SIZE = 12;
export const MIN_QUERY_LENGTH = 2;

// role tabs: ALUMNI is the directory's default, ALL means "no role filter"
export const ROLE_OPTIONS = [
  { value: "ALUMNI", label: "Alumni" },
  { value: "STUDENT", label: "Students" },
  { value: "ALL", label: "Everyone" },
];

export const DEFAULT_FILTERS = Object.freeze({
  q: "",
  role: "ALUMNI",
  branch: "",
  openTo: "",
  batch: "",
  company: "",
  designation: "",
  skills: "",
});

const TEXT_KEYS = ["q", "branch", "batch", "company", "designation", "skills", "openTo"];
const VALID_ROLES = ROLE_OPTIONS.map((r) => r.value);

const clean = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

export function parsePage(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// URLSearchParams -> filters (unknown/invalid values fall back to defaults)
export function urlToFilters(searchParams) {
  const filters = { ...DEFAULT_FILTERS };
  for (const key of TEXT_KEYS) {
    filters[key] = clean(searchParams.get(key));
  }
  const role = clean(searchParams.get("role")).toUpperCase();
  filters.role = VALID_ROLES.includes(role) ? role : DEFAULT_FILTERS.role;
  return { filters, page: parsePage(searchParams.get("page")) };
}

// filters -> URLSearchParams, omitting anything that equals its default so URLs stay short
export function filtersToUrl(filters, page = 1) {
  const params = new URLSearchParams();
  for (const key of TEXT_KEYS) {
    const value = clean(filters[key]);
    if (value) params.set(key, value);
  }
  if (filters.role && filters.role !== DEFAULT_FILTERS.role) params.set("role", filters.role);
  if (page > 1) params.set("page", String(page));
  return params;
}

// filters -> query params for GET /api/search (type=people), blanks dropped
export function filtersToApiParams(filters, page = 1, limit = PAGE_SIZE) {
  const params = { type: "people", page, limit };
  for (const key of TEXT_KEYS) {
    const value = clean(filters[key]);
    if (value) params[key] = value;
  }
  if (filters.role && filters.role !== "ALL") params.role = filters.role;
  return params;
}

// how many refinements (beyond the text box and role tab) are applied - drives "Clear filters"
export function activeFilterCount(filters) {
  return ["branch", "batch", "company", "designation", "skills", "openTo"].filter((k) => clean(filters[k])).length;
}

export function hasAnyCriteria(filters) {
  return Boolean(clean(filters.q)) || activeFilterCount(filters) > 0 || filters.role !== DEFAULT_FILTERS.role;
}

// clears refinements but keeps the chosen role tab
export function clearRefinements(filters) {
  return { ...DEFAULT_FILTERS, role: filters.role };
}
