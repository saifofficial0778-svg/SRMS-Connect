import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_JOB_FORM,
  availableOpenToOptions,
  experienceLabel,
  extractFieldErrors,
  formToPayload,
  isSafeHttpsUrl,
  jobToForm,
  jobTypeLabel,
  openToLabel,
  parseSkills,
  sameIntents,
  toggleIntent,
  validateJobForm,
} from "../src/utils/jobFormat.js";
import {
  DEFAULT_JOB_FILTERS,
  JOBS_PAGE_SIZE,
  activeJobFilterCount,
  clearJobFilters,
  hasAnyJobCriteria,
  jobFiltersToApiParams,
  jobFiltersToUrl,
  urlToJobFilters,
} from "../src/utils/jobParams.js";
import { createJobClient } from "../src/services/jobClient.js";
import { describeNotification } from "../src/utils/notificationFormat.js";
import { DEFAULT_FILTERS, activeFilterCount, filtersToApiParams, filtersToUrl, urlToFilters } from "../src/utils/searchParams.js";

const goodForm = {
  ...EMPTY_JOB_FORM,
  title: "Software Engineer",
  company: "Acme Labs",
  location: "Noida",
  description: "Build and operate our backend services.",
  apply_url: "https://acme.example/careers/42",
};

// ======================= labels =======================

test("job type and experience labels", () => {
  assert.equal(jobTypeLabel("FULL_TIME"), "Full-time");
  assert.equal(jobTypeLabel("INTERNSHIP"), "Internship");
  assert.equal(experienceLabel(0, 0), "Fresher");
  assert.equal(experienceLabel(0, null), "Any experience");
  assert.equal(experienceLabel(2, null), "2+ years");
  assert.equal(experienceLabel(1, 3), "1-3 years");
  assert.equal(experienceLabel(2, 2), "2 years");
  assert.equal(experienceLabel(1, 1), "1 year");
});

test("only plain https links are treated as safe application links", () => {
  assert.equal(isSafeHttpsUrl("https://acme.example/apply"), true);
  for (const bad of ["javascript:alert(1)", "http://acme.example", "data:text/html,x", "https://user:pw@acme.example", "acme.example", ""]) {
    assert.equal(isSafeHttpsUrl(bad), false, bad);
  }
});

// ======================= job form validation =======================

test("a complete form is valid and maps to the API payload", () => {
  assert.deepEqual(validateJobForm({ ...goodForm, skills: "React, Node.js" }), {});

  assert.deepEqual(formToPayload({ ...goodForm, title: "  Software Engineer ", experience_min: "1", experience_max: "3", skills: "React, react, Node.js,," }), {
    title: "Software Engineer",
    company: "Acme Labs",
    location: "Noida",
    job_type: "FULL_TIME",
    experience_min: 1,
    experience_max: 3,
    description: "Build and operate our backend services.",
    apply_url: "https://acme.example/careers/42",
    skills: ["React", "Node.js"],
  });
});

test("an empty max experience means no upper limit (null), min defaults to 0", () => {
  const payload = formToPayload({ ...goodForm, experience_min: "", experience_max: "" });
  assert.equal(payload.experience_min, 0);
  assert.equal(payload.experience_max, null);
});

test("every required field is reported with a friendly message", () => {
  const errors = validateJobForm(EMPTY_JOB_FORM);
  for (const field of ["title", "company", "location", "description", "apply_url"]) {
    assert.ok(errors[field], `${field} should have an error`);
  }
  assert.match(errors.title, /required/);
});

test("lengths, experience range and skills are checked", () => {
  assert.match(validateJobForm({ ...goodForm, title: "ab" }).title, /at least 3/);
  assert.match(validateJobForm({ ...goodForm, description: "too short" }).description, /at least 20/);
  assert.match(validateJobForm({ ...goodForm, title: "x".repeat(151) }).title, /at most 150/);
  assert.ok(validateJobForm({ ...goodForm, experience_min: "-1" }).experience_min);
  assert.ok(validateJobForm({ ...goodForm, experience_min: "2.5" }).experience_min);
  assert.ok(validateJobForm({ ...goodForm, experience_min: "41" }).experience_min);
  assert.match(validateJobForm({ ...goodForm, experience_min: "5", experience_max: "2" }).experience_max, /lower than minimum/);
  assert.equal(validateJobForm({ ...goodForm, experience_min: "2", experience_max: "2" }).experience_max, undefined);
  assert.ok(validateJobForm({ ...goodForm, skills: Array.from({ length: 11 }, (_, i) => `s${i}`).join(",") }).skills);
});

test("the application link must be https", () => {
  assert.match(validateJobForm({ ...goodForm, apply_url: "http://acme.example" }).apply_url, /https/);
  assert.ok(validateJobForm({ ...goodForm, apply_url: "javascript:alert(1)" }).apply_url);
  assert.equal(validateJobForm({ ...goodForm, apply_url: "https://acme.example" }).apply_url, undefined);
});

test("skills are split, trimmed and de-duplicated", () => {
  assert.deepEqual(parseSkills(" React , Node.js,react,, C++ "), ["React", "Node.js", "C++"]);
  assert.deepEqual(parseSkills(""), []);
});

test("editing: a job from the API round-trips through the form", () => {
  const job = {
    title: "Data Analyst", company: "Globex", location: "Remote", job_type: "INTERNSHIP", experience_min: 0,
    experience_max: 1, description: "Analyse things carefully.", apply_url: "https://globex.example/jobs", skills: ["SQL", "Python"],
  };
  const form = jobToForm(job);
  assert.equal(form.skills, "SQL, Python");
  assert.equal(form.experience_max, "1");
  assert.deepEqual(formToPayload(form), { ...job });
  assert.equal(jobToForm({ ...job, experience_max: null }).experience_max, "");
});

test("server validation errors are mapped onto form fields", () => {
  const error = { response: { data: { errors: [
    { path: ["apply_url"], message: "Application link must be a secure https:// URL" },
    { path: ["title"], message: "Title is too short" },
    { path: ["title"], message: "second message ignored" },
  ] } } };
  assert.deepEqual(extractFieldErrors(error), {
    apply_url: "Application link must be a secure https:// URL",
    title: "Title is too short",
  });
  assert.deepEqual(extractFieldErrors(new Error("Network Error")), {});
});

// ======================= job filters <-> URL <-> API =======================

test("job filters survive a round trip through the URL; junk falls back to defaults", () => {
  const filters = { q: "engineer", company: "Acme", location: "Noida", job_type: "INTERNSHIP", experience: "2", skills: "React, Node", tab: "mine" };
  const params = jobFiltersToUrl(filters, 3);
  const back = urlToJobFilters(new URLSearchParams(params.toString()));
  assert.deepEqual(back.filters, filters);
  assert.equal(back.page, 3);

  const junk = urlToJobFilters(new URLSearchParams("job_type=VOLUNTEER&experience=abc&page=-2&tab=admin"));
  assert.deepEqual(junk.filters, DEFAULT_JOB_FILTERS);
  assert.equal(junk.page, 1);
});

test("defaults stay out of the URL", () => {
  assert.equal(jobFiltersToUrl(DEFAULT_JOB_FILTERS, 1).toString(), "");
  assert.equal(jobFiltersToUrl({ ...DEFAULT_JOB_FILTERS, tab: "mine" }, 2).toString(), "tab=mine&page=2");
});

test("API params: blanks dropped, experience 0 kept, 'my jobs' becomes mine=true, one-letter search not sent", () => {
  assert.deepEqual(jobFiltersToApiParams({ ...DEFAULT_JOB_FILTERS, company: " Acme ", experience: "0" }, 2), {
    page: 2, limit: JOBS_PAGE_SIZE, company: "Acme", experience: "0",
  });
  assert.deepEqual(jobFiltersToApiParams({ ...DEFAULT_JOB_FILTERS, q: "a", tab: "mine" }), { page: 1, limit: JOBS_PAGE_SIZE, mine: "true" });
  assert.equal(jobFiltersToApiParams({ ...DEFAULT_JOB_FILTERS, q: "ab" }).q, "ab");
});

test("clearing keeps the current tab; counts drive the Clear button", () => {
  const filters = { ...DEFAULT_JOB_FILTERS, q: "x", company: "A", skills: "B", tab: "mine" };
  assert.deepEqual(clearJobFilters(filters), { ...DEFAULT_JOB_FILTERS, tab: "mine" });
  assert.equal(activeJobFilterCount(filters), 2);
  assert.equal(hasAnyJobCriteria(DEFAULT_JOB_FILTERS), false);
  assert.equal(hasAnyJobCriteria({ ...DEFAULT_JOB_FILTERS, q: "dev" }), true);
});

// ======================= job API client =======================

function fakeHttp(responses = {}) {
  const calls = [];
  const respond = (method) => async (url, body) => {
    calls.push({ method, url, body });
    return { data: { data: responses[`${method} ${url}`] } };
  };
  return { calls, get: respond("GET"), post: respond("POST"), patch: respond("PATCH"), delete: respond("DELETE") };
}

test("job client: list sends the filters and normalises the response", async () => {
  const http = fakeHttp({ "GET /jobs": { jobs: [{ id: 1 }], can_post: true, pagination: { page: 2, limit: 10, total: 25, totalPages: 3 } } });
  const client = createJobClient(http);

  const result = await client.listJobs({ ...DEFAULT_JOB_FILTERS, q: "engineer", job_type: "FULL_TIME" }, 2);

  assert.deepEqual(http.calls[0].body.params, { page: 2, limit: 10, q: "engineer", job_type: "FULL_TIME" });
  assert.deepEqual(result, { jobs: [{ id: 1 }], canPost: true, pagination: { page: 2, limit: 10, total: 25, totalPages: 3 } });

  const empty = await createJobClient(fakeHttp()).listJobs(DEFAULT_JOB_FILTERS, 4);
  assert.deepEqual(empty, { jobs: [], canPost: false, pagination: { page: 4, limit: 10, total: 0, totalPages: 1 } });
});

test("job client: create / update / status / delete / detail hit the right endpoints", async () => {
  const http = fakeHttp({ "POST /jobs": { id: 9 }, "GET /jobs/9": { id: 9, title: "T" }, "PATCH /jobs/9/status": { id: 9, status: "CLOSED" } });
  const client = createJobClient(http);

  assert.deepEqual(await client.createJob({ title: "T" }), { id: 9 });
  assert.deepEqual(await client.getJob(9), { id: 9, title: "T" });
  await client.updateJob(9, { title: "New" });
  assert.deepEqual(await client.setJobStatus(9, "CLOSED"), { id: 9, status: "CLOSED" });
  await client.deleteJob(9);

  assert.deepEqual(http.calls.map((c) => [c.method, c.url]), [
    ["POST", "/jobs"], ["GET", "/jobs/9"], ["PATCH", "/jobs/9"], ["PATCH", "/jobs/9/status"], ["DELETE", "/jobs/9"],
  ]);
  assert.deepEqual(http.calls[3].body, { status: "CLOSED" });
});

// ======================= job notifications =======================

test("a job notification links to the job", () => {
  const n = { type: "JOB_POSTED", reference_id: 14, extra: "Backend Engineer at Acme", actor: { user_id: 10, full_name: "Arjun Verma" } };
  const d = describeNotification(n);
  assert.equal(d.actorName, "Arjun Verma");
  assert.equal(d.message, "posted a new job");
  assert.equal(d.preview, "Backend Engineer at Acme");
  assert.equal(d.to, "/jobs/14");
  assert.equal(describeNotification({ ...n, reference_id: null }).to, "/jobs");
});

// ======================= Open to =======================

test("open-to options: Hiring is offered to alumni only", () => {
  const alumni = availableOpenToOptions("ALUMNI").map((o) => o.value);
  const student = availableOpenToOptions("STUDENT").map((o) => o.value);
  assert.deepEqual(alumni, ["MENTORSHIP", "REFERRALS", "RESUME_REVIEW", "MOCK_INTERVIEW", "HIRING"]);
  assert.deepEqual(student, ["MENTORSHIP", "REFERRALS", "RESUME_REVIEW", "MOCK_INTERVIEW"]);
  assert.equal(openToLabel("MOCK_INTERVIEW"), "Mock interviews");
});

test("toggling and comparing selections", () => {
  assert.deepEqual(toggleIntent([], "MENTORSHIP"), ["MENTORSHIP"]);
  assert.deepEqual(toggleIntent(["MENTORSHIP", "HIRING"], "MENTORSHIP"), ["HIRING"]);
  assert.equal(sameIntents(["A", "B"], ["B", "A"]), true); // order doesn't matter: Save stays disabled
  assert.equal(sameIntents(["A"], ["A", "B"]), false);
  assert.equal(sameIntents(undefined, []), true);
});

test("the directory can filter by what people are open to", () => {
  assert.equal(DEFAULT_FILTERS.openTo, "");
  assert.equal(filtersToApiParams({ ...DEFAULT_FILTERS, openTo: "MENTORSHIP" }).openTo, "MENTORSHIP");
  assert.equal("openTo" in filtersToApiParams(DEFAULT_FILTERS), false);
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, openTo: "HIRING" }), 1);

  const filters = { ...DEFAULT_FILTERS, openTo: "REFERRALS" };
  assert.equal(filtersToUrl(filters, 1).get("openTo"), "REFERRALS");
  assert.equal(urlToFilters(new URLSearchParams("openTo=REFERRALS")).filters.openTo, "REFERRALS");
});
