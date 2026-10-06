import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_GAP_FILTERS,
  alumniSentence,
  barWidth,
  coverageSentence,
  demandSentence,
  formatShare,
  gapFiltersToApiParams,
  gapFiltersToUrl,
  gapState,
  hasGapFilters,
  jobTypeName,
  pluralize,
  toBarRows,
  trendLabel,
  urlToGapFilters,
} from "../src/utils/insightFormat.js";
import { createInsightClient } from "../src/services/insightClient.js";

// ======================= numbers are shown as they are =======================

test("shares and plurals", () => {
  assert.equal(formatShare(66.7), "66.7%");
  assert.equal(formatShare(50), "50%");
  assert.equal(formatShare(0), "0%");
  assert.equal(formatShare(undefined), "0%"); // never "NaN%"
  assert.equal(pluralize(1, "job"), "1 job");
  assert.equal(pluralize(3, "job"), "3 jobs");
  assert.equal(pluralize(2, "alumnus", "alumni"), "2 alumni");
  assert.equal(jobTypeName("FULL_TIME"), "Full-time");
});

test("bar widths are proportional to the largest value, and a small count stays visible", () => {
  assert.equal(barWidth(10, 10), 100);
  assert.equal(barWidth(5, 10), 50);
  assert.equal(barWidth(1, 100), 3); // not rounded down to nothing
  assert.equal(barWidth(0, 10), 0); // zero really is empty
  assert.equal(barWidth(5, 0), 0);
  assert.equal(barWidth(20, 10), 100); // never overflows its track
});

test("bar rows keep the server's order and values exactly", () => {
  const rows = toBarRows(
    [{ skill_key: "nodejs", skill: "Node.js", count: 4, share: 66.7 }, { skill_key: "react", skill: "React", count: 2, share: 33.3 }],
    { key: "skill_key", label: "skill", value: "count", detail: (s) => formatShare(s.share) }
  );
  assert.deepEqual(rows, [
    { key: "nodejs", label: "Node.js", value: 4, width: 100, detail: "66.7%" },
    { key: "react", label: "React", value: 2, width: 50, detail: "33.3%" },
  ]);
  assert.deepEqual(toBarRows([], { label: "skill", value: "count" }), []);
  assert.deepEqual(toBarRows(undefined, { label: "skill", value: "count" }), []);
});

test("trend is described in words and a symbol, from the two counts", () => {
  assert.deepEqual(trendLabel({ recent: 3, previous: 0, direction: "new" }), { symbol: "★", text: "New this period", tone: "up" });
  assert.equal(trendLabel({ recent: 4, previous: 2, direction: "up" }).text, "2 more than before");
  assert.equal(trendLabel({ recent: 1, previous: 5, direction: "down" }).text, "4 fewer than before");
  assert.equal(trendLabel({ recent: 2, previous: 2, direction: "flat" }).text, "No change");
  assert.equal(trendLabel({}).text, "No change");
});

// ======================= skill gap filters =======================

test("gap filters survive the URL; junk is ignored", () => {
  const filters = { job_type: "INTERNSHIP", role: "data analyst" };
  assert.deepEqual(urlToGapFilters(new URLSearchParams(gapFiltersToUrl(filters).toString())), filters);
  assert.deepEqual(urlToGapFilters(new URLSearchParams("job_type=VOLUNTEER&role=%20%20")), DEFAULT_GAP_FILTERS);
  assert.equal(gapFiltersToUrl(DEFAULT_GAP_FILTERS).toString(), "");
});

test("API params: blanks dropped, a one-letter role is not sent, and there is no way to name a user", () => {
  assert.deepEqual(gapFiltersToApiParams(DEFAULT_GAP_FILTERS), {});
  assert.deepEqual(gapFiltersToApiParams({ job_type: "FULL_TIME", role: " backend " }), { job_type: "FULL_TIME", role: "backend" });
  assert.deepEqual(gapFiltersToApiParams({ job_type: "", role: "b" }), {});
  assert.deepEqual(Object.keys(gapFiltersToApiParams({ job_type: "FULL_TIME", role: "dev", user_id: 9 })), ["job_type", "role"]);
  assert.equal(hasGapFilters(DEFAULT_GAP_FILTERS), false);
  assert.equal(hasGapFilters({ job_type: "", role: " dev " }), true);
});

// ======================= skill gap states and wording =======================

const summary = (over = {}) => ({
  jobs_considered: 3, jobs_with_skills: 3, your_skills: 2, demanded_skills: 7, matched_skills: 2,
  missing_skills: 5, requirements_total: 9, requirements_met: 3, coverage_percent: 33.3, ...over,
});

test("the page explains why there is nothing to show instead of showing fake results", () => {
  assert.equal(gapState({ summary: summary() }), "ok");
  assert.equal(gapState({ summary: summary({ jobs_considered: 0, jobs_with_skills: 0 }) }), "no-jobs");
  assert.equal(gapState({ summary: summary({ jobs_with_skills: 0 }) }), "no-job-skills");
  assert.equal(gapState({ summary: summary({ your_skills: 0 }) }), "no-profile-skills");
  assert.equal(gapState({ summary: summary({ missing_skills: 0 }) }), "all-matched");
  assert.equal(gapState(null), "no-jobs");
  assert.equal(gapState({}), "no-jobs");
});

test("sentences state the counts behind every number", () => {
  assert.equal(coverageSentence(summary()), "You already meet 3 of the 9 skill requirements across 3 jobs (33.3%).");
  assert.equal(coverageSentence(summary({ requirements_total: 0 })), "");
  assert.equal(coverageSentence(summary({ jobs_with_skills: 1, requirements_total: 3, requirements_met: 3, coverage_percent: 100 })),
    "You already meet 3 of the 3 skill requirements across 1 job (100%).");
  assert.equal(demandSentence({ jobs_requiring: 2, share_of_jobs: 66.7 }, summary()), "Asked for by 2 of 3 jobs (66.7%)");
  assert.equal(alumniSentence(4), "4 alumni on SRMS Connect list it");
  assert.equal(alumniSentence(1), "1 alumnus on SRMS Connect lists it");
  assert.equal(alumniSentence(0), "No alumni list it yet");
});

// ======================= API client =======================

function fakeHttp(payloads = {}) {
  const calls = [];
  return {
    calls,
    get: async (url, config) => {
      calls.push({ url, config });
      return { data: { data: payloads[url] } };
    },
  };
}

test("insight client: endpoints and params", async () => {
  const http = fakeHttp({
    "/insights/industry-pulse": { totals: { alumni: 20 }, alumni_skills: [{ skill: "React", count: 5 }], data_source: "from SRMS Connect" },
    "/insights/skill-gap": { summary: { missing_skills: 2 }, missing: [{ skill: "Node.js" }], ranking_rule: "by demand" },
  });
  const client = createInsightClient(http);

  const pulse = await client.getIndustryPulse();
  assert.equal(http.calls[0].url, "/insights/industry-pulse");
  assert.equal(pulse.totals.alumni, 20);
  assert.equal(pulse.totals.open_jobs, 0); // absent numbers default to zero
  assert.deepEqual(pulse.demanded_skills, []);
  assert.deepEqual(pulse.trending_skills.skills, []);
  assert.equal(pulse.data_source, "from SRMS Connect");

  const gap = await client.getSkillGap({ job_type: "INTERNSHIP", role: "backend" });
  assert.deepEqual(http.calls[1], { url: "/insights/skill-gap", config: { params: { job_type: "INTERNSHIP", role: "backend" } } });
  assert.equal(gap.summary.missing_skills, 2);
  assert.equal(gap.summary.jobs_considered, 0);
  assert.deepEqual(gap.matched, []);
  assert.equal(gap.ranking_rule, "by demand");
});

test("insight client: an empty response becomes empty lists and zeros, never invented data", async () => {
  const client = createInsightClient(fakeHttp());
  const pulse = await client.getIndustryPulse();
  assert.deepEqual(pulse.totals, { alumni: 0, alumni_with_skills: 0, open_jobs: 0, open_jobs_with_skills: 0 });
  assert.deepEqual([pulse.alumni_skills, pulse.top_companies, pulse.top_roles], [[], [], []]);

  const gap = await client.getSkillGap(DEFAULT_GAP_FILTERS);
  assert.deepEqual(gap.missing, []);
  assert.equal(gap.summary.coverage_percent, 0);
  assert.equal(gapState(gap), "no-jobs");
});

test("insight client: failures reach the caller", async () => {
  const client = createInsightClient({ get: async () => { throw new Error("429"); } });
  await assert.rejects(client.getIndustryPulse(), /429/);
  await assert.rejects(client.getSkillGap(DEFAULT_GAP_FILTERS), /429/);
});
