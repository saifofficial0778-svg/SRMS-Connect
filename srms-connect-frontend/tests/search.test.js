import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers";

import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  activeFilterCount,
  clearRefinements,
  filtersToApiParams,
  filtersToUrl,
  hasAnyCriteria,
  parsePage,
  urlToFilters,
} from "../src/utils/searchParams.js";
import { academicLine, firstName, headline, isVerifiedAlumni, searchResultSubtitle, suggestionAction, suggestionSubtitle } from "../src/utils/personFormat.js";
import { createSearchClient } from "../src/services/searchClient.js";
import { createDebouncedSearcher } from "../src/services/searchFlow.js";

const tick = () => new Promise((r) => setImmediate(r));

// ======================= directory filters <-> URL <-> API =======================

test("urlToFilters falls back to defaults and rejects unknown roles / bad pages", () => {
  const empty = urlToFilters(new URLSearchParams(""));
  assert.deepEqual(empty.filters, DEFAULT_FILTERS);
  assert.equal(empty.page, 1);

  const weird = urlToFilters(new URLSearchParams("role=admin&page=-4&q=%20sai%20"));
  assert.equal(weird.filters.role, "ALUMNI"); // ADMIN is not a valid tab
  assert.equal(weird.filters.q, "sai"); // trimmed
  assert.equal(weird.page, 1);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("abc"), 1);
});

test("filters survive a round trip through the URL", () => {
  const filters = { q: "sai", role: "STUDENT", branch: "CA", openTo: "", batch: "2024", company: "Wipro", designation: "Dev", skills: "React, Node" };
  const params = filtersToUrl(filters, 3);
  const back = urlToFilters(new URLSearchParams(params.toString()));
  assert.deepEqual(back.filters, filters);
  assert.equal(back.page, 3);
});

test("default values are left out of the URL", () => {
  assert.equal(filtersToUrl(DEFAULT_FILTERS, 1).toString(), "");
  assert.equal(filtersToUrl({ ...DEFAULT_FILTERS, role: "ALL" }, 1).toString(), "role=ALL");
  assert.equal(filtersToUrl({ ...DEFAULT_FILTERS, q: "sai" }, 2).toString(), "q=sai&page=2");
});

test("API params: type=people, blanks dropped, ALL means no role filter", () => {
  assert.deepEqual(filtersToApiParams({ ...DEFAULT_FILTERS, q: "  sai ", company: "", role: "ALL" }, 2), {
    type: "people", page: 2, limit: PAGE_SIZE, q: "sai",
  });
  assert.deepEqual(filtersToApiParams({ ...DEFAULT_FILTERS, role: "ALUMNI", batch: "2024", skills: "React,Node" }, 1, 5), {
    type: "people", page: 1, limit: 5, role: "ALUMNI", batch: "2024", skills: "React,Node",
  });
});

test("clearing filters keeps the chosen role tab", () => {
  const cleared = clearRefinements({ ...DEFAULT_FILTERS, role: "STUDENT", q: "x", branch: "CA", skills: "a" });
  assert.deepEqual(cleared, { ...DEFAULT_FILTERS, role: "STUDENT" });
});

test("activeFilterCount / hasAnyCriteria drive the Clear and empty-state UI", () => {
  assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, branch: "CA", company: " " }), 1);
  assert.equal(hasAnyCriteria(DEFAULT_FILTERS), false);
  assert.equal(hasAnyCriteria({ ...DEFAULT_FILTERS, q: "sai" }), true);
  assert.equal(hasAnyCriteria({ ...DEFAULT_FILTERS, role: "ALL" }), true);
});

// ======================= display helpers / Verified Alumni =======================

test("Verified Alumni flag accepts MySQL 0/1 and booleans", () => {
  assert.equal(isVerifiedAlumni({ is_verified_alumni: 1 }), true);
  assert.equal(isVerifiedAlumni({ is_verified_alumni: true }), true);
  assert.equal(isVerifiedAlumni({ is_verified_alumni: 0 }), false); // must not render a stray "0"
  assert.equal(isVerifiedAlumni({}), false);
  assert.equal(isVerifiedAlumni(null), false);
});

test("headline and academic line", () => {
  assert.equal(headline({ designation: "Developer", company: "Wipro" }), "Developer at Wipro");
  assert.equal(headline({ company: "Wipro" }), "Wipro");
  assert.equal(headline({}), "");
  assert.equal(academicLine({ role: "ALUMNI", branch: "Computer Applications", batch_year: 2024 }), "Computer Applications · Class of 2024");
  assert.equal(academicLine({ role: "STUDENT", branch: "Computer Applications", batch_year: 2025 }), "Computer Applications · Batch 2025");
  assert.equal(academicLine({ role: "STUDENT" }), "");
});

test("search result subtitle falls back from headline to academic info to location", () => {
  assert.equal(searchResultSubtitle({ designation: "Dev", company: "X" }), "Dev at X");
  assert.equal(searchResultSubtitle({ role: "ALUMNI", branch: "CA", batch_year: 2020 }), "CA · Class of 2020");
  assert.equal(searchResultSubtitle({ location: "Delhi" }), "Delhi");
});

// ======================= API client =======================

const fakeHttp = (data) => {
  const calls = [];
  return {
    calls,
    get: async (url, config) => {
      calls.push({ url, config });
      return { data: { success: true, data } };
    },
  };
};

test("searchAll calls GET /search?type=all and always returns people/posts/jobs arrays", async () => {
  const http = fakeHttp({ people: [{ user_id: 1 }] });
  const { searchAll } = createSearchClient(http);

  const result = await searchAll("sai");

  assert.equal(http.calls[0].url, "/search");
  assert.deepEqual(http.calls[0].config.params, { q: "sai", type: "all" });
  assert.deepEqual(result, { people: [{ user_id: 1 }], posts: [], jobs: [] });
});

test("searchPeople sends filters as query params and returns normalised pagination", async () => {
  const http = fakeHttp({ people: [], pagination: { page: 2, limit: 12, total: 30, totalPages: 3 } });
  const { searchPeople } = createSearchClient(http);

  const result = await searchPeople({ ...DEFAULT_FILTERS, q: "sai", branch: "CA" }, 2);

  assert.deepEqual(http.calls[0].config.params, { type: "people", page: 2, limit: 12, q: "sai", role: "ALUMNI", branch: "CA" });
  assert.deepEqual(result.pagination, { page: 2, limit: 12, total: 30, totalPages: 3 });
});

test("clients tolerate an empty / partial response body", async () => {
  const { searchAll, searchPeople, getSearchFilters } = createSearchClient({ get: async () => ({ data: {} }) });
  assert.deepEqual(await searchAll("sai"), { people: [], posts: [], jobs: [] });
  assert.deepEqual((await searchPeople(DEFAULT_FILTERS, 4)).pagination, { page: 4, limit: 12, total: 0, totalPages: 1 });
  assert.deepEqual(await getSearchFilters(), { branches: [], batchYears: [] });
});

test("getSearchFilters returns dropdown values", async () => {
  const http = fakeHttp({ branches: ["CA"], batchYears: [2025, 2024] });
  const { getSearchFilters } = createSearchClient(http);
  assert.deepEqual(await getSearchFilters(), { branches: ["CA"], batchYears: [2025, 2024] });
  assert.equal(http.calls[0].url, "/search/filters");
});

test("API errors propagate to the caller", async () => {
  const { searchAll } = createSearchClient({ get: async () => { throw new Error("boom"); } });
  await assert.rejects(searchAll("sai"), /boom/);
});

// ======================= navbar search flow =======================

function setup(search) {
  mock.timers.enable({ apis: ["setTimeout"] });
  const states = [];
  const searcher = createDebouncedSearcher({ search, onChange: (s) => states.push(s), delay: 350 });
  return { states, searcher, last: () => states[states.length - 1] };
}

test("flow: empty input is idle and short input asks for more characters (no request)", async (t) => {
  const search = mock.fn(async () => ({}));
  const { searcher, last } = setup(search);
  t.after(() => mock.timers.reset());

  searcher.update("");
  assert.equal(last().status, "idle");
  searcher.update(" a ");
  assert.equal(last().status, "too-short");

  mock.timers.tick(1000);
  await tick();
  assert.equal(search.mock.callCount(), 0);
});

test("flow: waits for typing to stop, then searches once with the trimmed query", async (t) => {
  const search = mock.fn(async (q) => ({ people: [{ user_id: 1, q }], posts: [] }));
  const { searcher, last } = setup(search);
  t.after(() => mock.timers.reset());

  searcher.update("sa");
  mock.timers.tick(200);
  searcher.update("sak");
  mock.timers.tick(200);
  searcher.update(" saksh ");
  assert.equal(last().status, "loading");
  assert.equal(search.mock.callCount(), 0); // still debouncing

  mock.timers.tick(350);
  await tick();

  assert.equal(search.mock.callCount(), 1);
  assert.deepEqual(search.mock.calls[0].arguments, ["saksh"]);
  assert.equal(last().status, "success");
  assert.equal(last().results.people[0].q, "saksh");
});

test("flow: a slow older response never overwrites a newer one", async (t) => {
  const resolvers = {};
  const search = mock.fn((q) => new Promise((resolve) => { resolvers[q] = resolve; }));
  const { searcher, last } = setup(search);
  t.after(() => mock.timers.reset());

  searcher.update("first");
  mock.timers.tick(350);
  searcher.update("second");
  mock.timers.tick(350);
  assert.equal(search.mock.callCount(), 2);

  resolvers.second({ people: [{ user_id: 2 }] });
  await tick();
  resolvers.first({ people: [{ user_id: 1 }] }); // arrives late
  await tick();

  assert.equal(last().status, "success");
  assert.equal(last().query, "second");
  assert.equal(last().results.people[0].user_id, 2);
});

test("flow: a failed request reports an error, and a retry can succeed", async (t) => {
  let fail = true;
  const search = mock.fn(async () => {
    if (fail) throw new Error("500");
    return { people: [], posts: [] };
  });
  const { searcher, last } = setup(search);
  t.after(() => mock.timers.reset());

  searcher.update("sai");
  mock.timers.tick(350);
  await tick();
  assert.equal(last().status, "error");

  fail = false;
  searcher.update("sai!");
  mock.timers.tick(350);
  await tick();
  assert.equal(last().status, "success");
});

test("flow: cancel() stops a pending search and ignores in-flight results", async (t) => {
  let resolve;
  const search = mock.fn(() => new Promise((r) => { resolve = r; }));
  const { searcher, states } = setup(search);
  t.after(() => mock.timers.reset());

  searcher.update("sai");
  searcher.cancel(); // e.g. navbar unmounts before the timer fires
  mock.timers.tick(1000);
  await tick();
  assert.equal(search.mock.callCount(), 0);

  searcher.update("sai2");
  mock.timers.tick(350);
  searcher.cancel(); // request already in flight
  resolve({ people: [] });
  await tick();
  assert.equal(states.some((s) => s.status === "success"), false);
});

// ======================= suggestions under a profile =======================

test("suggestion card: first name, subtitle and the right button for each relation", () => {
  assert.equal(firstName("Aditi Chauhan"), "Aditi");
  assert.equal(firstName("  Om  "), "Om");
  assert.equal(firstName(null), "this member");

  assert.equal(suggestionSubtitle({ role: "ALUMNI", designation: "Engineer", company: "Acme" }), "Engineer at Acme");
  assert.equal(suggestionSubtitle({ role: "STUDENT", branch: "CA", batch_year: 2025 }), "CA · Batch 2025");
  assert.equal(suggestionSubtitle({ role: "ALUMNI" }), "SRMS alumnus");
  assert.equal(suggestionSubtitle({ role: "STUDENT" }), "SRMS student");

  assert.deepEqual(suggestionAction("none"), { kind: "connect", label: "Connect", tone: "primary" });
  assert.deepEqual(suggestionAction(undefined), { kind: "connect", label: "Connect", tone: "primary" });
  assert.deepEqual(suggestionAction("sent"), { kind: "status", label: "Pending", tone: "muted" }); // no second request
  const connected = suggestionAction("connected");
  assert.equal(connected.kind, "link");
  assert.equal(connected.to({ user_id: 9 }), "/profile/9");
  const received = suggestionAction("received");
  assert.equal(received.label, "Respond");
  assert.equal(received.to({ user_id: 9 }), "/network");
});
