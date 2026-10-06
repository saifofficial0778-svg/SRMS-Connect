import { gapFiltersToApiParams } from "../utils/insightFormat.js";

const EMPTY_PULSE = {
  generated_at: null,
  data_source: "",
  totals: { alumni: 0, alumni_with_skills: 0, open_jobs: 0, open_jobs_with_skills: 0 },
  alumni_skills: [],
  demanded_skills: [],
  top_companies: [],
  top_roles: [],
  job_types: [],
  trending_skills: { window_days: 30, basis: "", skills: [] },
};

const EMPTY_GAP = {
  generated_at: null,
  data_source: "",
  ranking_rule: "",
  your_skills: [],
  summary: {
    jobs_considered: 0, jobs_with_skills: 0, your_skills: 0, demanded_skills: 0, matched_skills: 0,
    missing_skills: 0, requirements_total: 0, requirements_met: 0, coverage_percent: 0,
  },
  missing: [],
  matched: [],
  job_matches: [],
};

// Talks to /api/insights. The HTTP client is injected so it can be tested without axios.
// Missing parts of a response become empty lists / zeros - never invented values.
export function createInsightClient(http) {
  async function getIndustryPulse() {
    const response = await http.get("/insights/industry-pulse");
    const data = response.data?.data || {};
    return {
      ...EMPTY_PULSE,
      ...data,
      totals: { ...EMPTY_PULSE.totals, ...(data.totals || {}) },
      trending_skills: { ...EMPTY_PULSE.trending_skills, ...(data.trending_skills || {}) },
    };
  }

  // always the signed-in user's own gap; the filters only narrow which jobs are compared
  async function getSkillGap(filters) {
    const response = await http.get("/insights/skill-gap", { params: gapFiltersToApiParams(filters) });
    const data = response.data?.data || {};
    return { ...EMPTY_GAP, ...data, summary: { ...EMPTY_GAP.summary, ...(data.summary || {}) } };
  }

  return { getIndustryPulse, getSkillGap };
}
