import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CHART_METRICS,
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  audienceRows,
  changeLabel,
  chartGeometry,
  createImpressionTracker,
  formatCount,
  formatRate,
  niceMax,
  parseRange,
  parseSort,
  postPreview,
  postStatsLine,
  roleLabel,
  shortDate,
  viewerSubtitle,
  viewsLabel,
} from "../src/utils/analyticsFormat.js";
import { createAnalyticsClient } from "../src/services/analyticsClient.js";
import { describeNotification } from "../src/utils/notificationFormat.js";

function fakeHttp(reply) {
  const calls = [];
  const respond = (method) => async (url, a, b) => {
    calls.push({ method, url, body: method === "get" ? undefined : a, params: (method === "get" ? a : b)?.params });
    return { data: { data: reply } };
  };
  return { calls, get: respond("get"), post: respond("post") };
}

// ======================= ranges and sorting =======================

test("range and sort fall back to safe defaults for anything unexpected", () => {
  assert.deepEqual(RANGE_OPTIONS.map((r) => r.value), [7, 30, 90]);
  assert.equal(parseRange("7"), 7);
  assert.equal(parseRange("90"), 90);
  assert.equal(parseRange("365"), DEFAULT_RANGE);
  assert.equal(parseRange(null), DEFAULT_RANGE);
  assert.equal(parseRange("7; DROP"), DEFAULT_RANGE);
  assert.equal(parseSort("impressions"), "impressions");
  assert.equal(parseSort("likes"), "recent");
  assert.equal(parseSort(undefined), "recent");
});

// ======================= numbers =======================

test("counts are readable at every size", () => {
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(987), "987");
  assert.equal(formatCount(1234), "1,234");
  assert.equal(formatCount(15300), "15.3K");
  assert.equal(formatCount(20000), "20K");
  assert.equal(formatCount(2400000), "2.4M");
  assert.equal(formatCount(undefined), "0");
  assert.equal(formatCount("42"), "42");
  assert.equal(formatRate(12.5), "12.5%");
  assert.equal(formatRate(undefined), "0%");
});

test("change against the previous period says its direction in words and symbols, not colour", () => {
  assert.deepEqual(changeLabel({ value: 150, previous: 100, change_percent: 50 }, 7), { text: "▲ 50% vs previous 7 days", tone: "up" });
  assert.deepEqual(changeLabel({ value: 50, previous: 200, change_percent: -75 }, 30), { text: "▼ 75% vs previous 30 days", tone: "down" });
  assert.deepEqual(changeLabel({ value: 10, previous: 10, change_percent: 0 }, 7), { text: "No change vs previous 7 days", tone: "flat" });
  // nothing before: it is "new", never "infinite % growth"
  assert.deepEqual(changeLabel({ value: 12, previous: 0, change_percent: null }, 7), { text: "New — nothing in the previous 7 days", tone: "up" });
  assert.deepEqual(changeLabel({ value: 0, previous: 0, change_percent: null }, 90), { text: "No activity in this or the previous 90 days", tone: "none" });
  assert.deepEqual(changeLabel(undefined, 7), { text: "", tone: "none" });
});

test("dates are parsed by hand so the time zone can't move them a day", () => {
  assert.equal(shortDate("2026-10-04"), "4 Oct");
  assert.equal(shortDate("2026-01-31"), "31 Jan");
  assert.equal(shortDate(""), "");
  assert.equal(shortDate(undefined), "");
});

// ======================= chart geometry =======================

test("the y-axis tops out on a round number at or above the data", () => {
  assert.equal(niceMax(0), 4);
  assert.equal(niceMax(3), 4);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(18), 20);
  assert.equal(niceMax(35), 40);
  assert.equal(niceMax(41), 50);
  assert.equal(niceMax(120), 200);
  assert.equal(niceMax(900), 1000);
});

const week = [3, 0, 8, 5, 0, 12, 20].map((value, i) => ({ date: `2026-10-0${i + 1}`, post_impressions: value, profile_views: 0, search_appearances: i }));

test("chart geometry: baseline at zero, points inside the plot, one per day", () => {
  const g = chartGeometry(week, "post_impressions", { width: 700, height: 200, left: 40, right: 10, top: 10, bottom: 30 });
  assert.equal(g.max, 20);
  assert.equal(g.points.length, 7);
  assert.equal(g.baseline, 170);
  assert.equal(g.points[0].x, 40); // first day on the left edge of the plot
  assert.equal(g.points[6].x, 690); // last day on the right edge
  assert.equal(g.points[1].y, 170); // a zero sits on the baseline
  assert.equal(g.points[6].y, 10); // the maximum reaches the top
  assert.ok(g.points.every((p) => p.y >= 10 && p.y <= 170));
  assert.deepEqual(g.yTicks.map((t) => t.value), [0, 10, 20]);
  assert.equal(g.total, 48);
  assert.match(g.line, /^M40,\d+(\.\d)? L/);
  assert.match(g.area, /Z$/);
  assert.equal(g.xLabels[g.xLabels.length - 1].date, "2026-10-07"); // the last day is always labelled
});

test("chart geometry: an all-zero series is a flat line on the baseline, and an empty one is empty", () => {
  const flat = chartGeometry(week, "profile_views");
  assert.equal(flat.max, 4);
  assert.ok(flat.points.every((p) => p.y === flat.baseline));

  const empty = chartGeometry([], "post_impressions");
  assert.deepEqual(empty.points, []);
  assert.equal(empty.area, "");
  assert.equal(empty.total, 0);

  const single = chartGeometry([week[6]], "post_impressions");
  assert.equal(single.points.length, 1);
  assert.ok(Number.isFinite(single.points[0].x));
});

test("a long period gets a handful of date labels, not ninety", () => {
  const long = Array.from({ length: 90 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}-${i}`, post_impressions: i }));
  const g = chartGeometry(long, "post_impressions");
  assert.ok(g.xLabels.length <= 7);
  assert.equal(g.xLabels[0], g.points[0]);
  assert.equal(g.xLabels[g.xLabels.length - 1], g.points[89]);
});

test("the chart shows one metric at a time", () => {
  assert.deepEqual(CHART_METRICS.map((m) => m.key), ["post_impressions", "profile_views", "search_appearances"]);
});

// ======================= audience and people =======================

test("audience groups become ranked bars; an empty list stays empty", () => {
  const rows = audienceRows([{ label: "ALUMNI", people: 6 }, { label: "STUDENT", people: 3 }], roleLabel);
  assert.deepEqual(rows.map((r) => [r.label, r.value, r.width]), [["Alumni", 6, 100], ["Students", 3, 50]]);
  assert.deepEqual(audienceRows(undefined), []);
  assert.equal(audienceRows([{ label: "Acme", people: 1 }, { label: "Tiny", people: 0 }])[1].width, 4);
  assert.equal(roleLabel("SOMETHING"), "SOMETHING");
});

test("a viewer is described by their work, or their batch when they are a student", () => {
  assert.equal(viewerSubtitle({ role: "ALUMNI", designation: "Engineer", company: "Acme" }), "Engineer at Acme");
  assert.equal(viewerSubtitle({ role: "ALUMNI", company: "Acme" }), "Acme");
  assert.equal(viewerSubtitle({ role: "ALUMNI", branch: "CA", batch_year: 2024 }), "Alumnus · CA · Batch 2024");
  assert.equal(viewerSubtitle({ role: "STUDENT", branch: "CA", batch_year: 2025, company: "Wipro", designation: "Dev" }), "Student · CA · Batch 2025");
  assert.equal(viewsLabel(1), "1 view");
  assert.equal(viewsLabel(4), "4 views");
});

test("post preview and the author's stats line", () => {
  assert.equal(postPreview({ content: "  Hello \n world  " }), "Hello world");
  assert.equal(postPreview({ content: "x".repeat(200) }).length, 110);
  assert.equal(postPreview({ content: "", media_count: 2 }), "Post with 2 attachments");
  assert.equal(postPreview({ content: null, media_count: 1 }), "Post with 1 attachment");
  assert.equal(postPreview({}), "Post");

  assert.equal(postStatsLine({ impressions: 1234, reach: 300 }), "1,234 impressions · 300 people reached");
  assert.equal(postStatsLine({ impressions: 1, reach: 1 }), "1 impression · 1 person reached");
  assert.equal(postStatsLine({ impressions: 0, reach: 0 }), "No impressions yet");
  assert.equal(postStatsLine(undefined), ""); // someone else's post: nothing to show
});

// ======================= impression batching =======================

function manualTimers() {
  let pending = null;
  return {
    schedule: (fn) => { pending = fn; return 1; },
    cancel: () => { pending = null; },
    fire: async () => { const fn = pending; pending = null; if (fn) await fn(); },
    armed: () => pending !== null,
  };
}

test("tracker: posts seen within the delay go out as one batch, each post only once", async () => {
  const sent = [];
  const timers = manualTimers();
  const tracker = createImpressionTracker({ send: async (ids) => sent.push(ids), schedule: timers.schedule, cancel: timers.cancel });

  assert.equal(tracker.seen(3), true);
  assert.equal(tracker.seen(7), true);
  assert.equal(tracker.seen(3), false); // scrolled back to it: not a second report
  assert.equal(tracker.seen("9"), true);
  assert.equal(sent.length, 0);
  assert.equal(tracker.pending(), 3);

  await timers.fire();
  assert.deepEqual(sent, [[3, 7, 9]]);
  assert.equal(tracker.pending(), 0);

  tracker.seen(3);
  assert.equal(timers.armed(), false); // already reported in this session
});

test("tracker: junk ids are ignored and a full batch is sent straight away", async () => {
  const sent = [];
  const timers = manualTimers();
  const tracker = createImpressionTracker({ send: async (ids) => sent.push(ids), maxBatch: 3, schedule: timers.schedule, cancel: timers.cancel });

  for (const junk of [0, -1, "abc", null, undefined, 1.5]) assert.equal(tracker.seen(junk), false);
  assert.equal(timers.armed(), false);

  tracker.seen(1);
  tracker.seen(2);
  tracker.seen(3);
  await Promise.resolve();
  assert.deepEqual(sent, [[1, 2, 3]]);
  assert.equal(timers.armed(), false); // the timer was cancelled by the early flush
});

test("tracker: a failed batch is forgotten so those posts can be reported again", async () => {
  let fail = true;
  const sent = [];
  const timers = manualTimers();
  const tracker = createImpressionTracker({
    send: async (ids) => { if (fail) throw new Error("offline"); sent.push(ids); },
    schedule: timers.schedule, cancel: timers.cancel,
  });

  tracker.seen(5);
  await timers.fire(); // rejected, but must not throw into the page
  assert.deepEqual(sent, []);

  fail = false;
  assert.equal(tracker.seen(5), true);
  await timers.fire();
  assert.deepEqual(sent, [[5]]);
});

// ======================= API client =======================

test("client: overview fills in every number, even from an empty response", async () => {
  const empty = await createAnalyticsClient(fakeHttp(undefined)).getOverview(7);
  assert.deepEqual(empty.totals.post_impressions, { value: 0, previous: 0, change_percent: null });
  assert.equal(empty.totals.engagement_rate, 0);
  assert.deepEqual(empty.series, []);
  assert.deepEqual(empty.searchers, { roles: [], companies: [], designations: [] });
  assert.deepEqual(empty.range, { days: 7 });

  const http = fakeHttp({ totals: { post_impressions: { value: 9, previous: 3, change_percent: 200 }, engagement_rate: "12.5" }, series: [{ date: "2026-10-01" }], searchers: { roles: [{ label: "ALUMNI", people: 2 }] } });
  const full = await createAnalyticsClient(http).getOverview(30);
  assert.deepEqual(http.calls[0], { method: "get", url: "/analytics/overview", body: undefined, params: { days: 30 } });
  assert.equal(full.totals.post_impressions.value, 9);
  assert.equal(full.totals.engagement_rate, 12.5);
  assert.equal(full.totals.searchers.value, 0); // missing metric -> zero, not undefined
  assert.deepEqual(full.searchers.companies, []);
});

test("client: lists call their own endpoints and never name a user", async () => {
  const http = fakeHttp({ posts: [{ id: 3 }], viewers: [{ user_id: 9 }], total_views: 14, pagination: { page: 2, limit: 8, total: 11, totalPages: 2 } });
  const client = createAnalyticsClient(http);

  const posts = await client.getPostStats({ days: 30, sort: "impressions" }, 2, 8);
  const viewers = await client.getProfileViewers(7, 2, 8);

  assert.deepEqual(http.calls[0], { method: "get", url: "/analytics/posts", body: undefined, params: { days: 30, sort: "impressions", page: 2, limit: 8 } });
  assert.deepEqual(http.calls[1], { method: "get", url: "/analytics/profile-viewers", body: undefined, params: { days: 7, page: 2, limit: 8 } });
  assert.equal(posts.pagination.totalPages, 2);
  assert.equal(viewers.totalViews, 14);
  for (const call of http.calls) assert.doesNotMatch(JSON.stringify(call.params), /user/i);
});

test("client: impressions send clean post ids only, and nothing at all when there are none", async () => {
  const http = fakeHttp({});
  const client = createAnalyticsClient(http);

  await client.recordImpressions([3, "7", 3, 0, -2, "x", 1.5]);
  assert.deepEqual(http.calls, [{ method: "post", url: "/analytics/impressions", body: { post_ids: [3, 7] }, params: undefined }]);

  await client.recordImpressions([]);
  await client.recordImpressions(undefined);
  assert.equal(http.calls.length, 1);

  await client.recordImpressions(Array.from({ length: 80 }, (_, i) => i + 1));
  assert.equal(http.calls[1].body.post_ids.length, 50); // the server's limit per request
});

test("client: my posts come from /posts/mine and never carry a user id", async () => {
  const http = fakeHttp({ posts: [{ id: 3, analytics: { impressions: 4, reach: 2 } }], pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } });
  const result = await createAnalyticsClient(http).getMyPosts();
  assert.deepEqual(http.calls[0], { method: "get", url: "/posts/mine", body: undefined, params: { page: 1, limit: 12 } });
  assert.equal(result.posts[0].analytics.impressions, 4);

  const none = await createAnalyticsClient(fakeHttp(undefined)).getMyPosts(2, 5);
  assert.deepEqual(none, { posts: [], pagination: { page: 2, limit: 5, total: 0, totalPages: 1 } });
  assert.equal(createAnalyticsClient(http).getUserPosts, undefined); // nothing lists another member's posts
});

// ======================= notification =======================

test("a profile view notification names the viewer and opens the viewers list", () => {
  const described = describeNotification({ type: "PROFILE_VIEW", actor: { user_id: 9, full_name: "Arjun Verma" }, reference_id: 9 });
  assert.equal(described.actorName, "Arjun Verma");
  assert.equal(described.message, "viewed your profile");
  assert.equal(described.to, "/analytics#viewers");
});
