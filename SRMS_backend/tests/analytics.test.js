process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.RATE_LIMIT_DISABLED = "true";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const AnalyticsRepository = require("../src/modules/analytics/analytics.repository");
const AnalyticsService = require("../src/modules/analytics/analytics.service");
const { periods, daysBetween, metric, toPublicViewer, toPostStats } = AnalyticsService;
const validation = require("../src/modules/analytics/analytics.validation");
const { RANGES, CAPS, DEFINITIONS } = require("../src/modules/analytics/analytics.constants");
const analyticsRoutes = require("../src/modules/analytics/analytics.route");
const PostRepository = require("../src/modules/post/post.repository");
const PostService = require("../src/modules/post/post.service");
const postRoutes = require("../src/modules/post/post.route");
const ProfileRepository = require("../src/modules/profile/profile.repository");
const ProfileService = require("../src/modules/profile/profile.service");
const SearchRepository = require("../src/modules/search/search.repository");
const SearchService = require("../src/modules/search/search.service");
const { searchQuerySchema } = require("../src/modules/search/search.validation");
const NotificationService = require("../src/modules/notification/notification.service");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");

const stubNotifications = require("./helpers/stubNotifications");
const stubSkills = require("./helpers/stubSkills");
const stubAnalytics = require("./helpers/stubAnalytics");

let notify, recorded;
beforeEach(() => {
    notify = stubNotifications(mock);
    stubSkills(mock);
    recorded = stubAnalytics(mock);
});
afterEach(() => mock.restoreAll());

const student = { userId: 5, role: "STUDENT" };
const alumnus = { userId: 9, role: "ALUMNI" };
const admin = { userId: 1, role: "ADMIN" };

// every SQL statement the code would send, without a database
function captureSql(rows = [[{}]]) {
    const calls = [];
    const fake = async (sql, params) => {
        calls.push({ sql: String(sql).replace(/\s+/g, " "), params });
        return typeof rows === "function" ? rows(sql) : rows;
    };
    mock.method(pool, "execute", fake);
    mock.method(pool, "query", fake);
    return calls;
}

// ======================= periods and maths =======================

test("a period is N days ending today, compared with the N days right before it", () => {
    const p = periods(7, new Date(2026, 9, 10, 15, 30)); // 10 Oct 2026, afternoon
    assert.deepEqual(p, { days: 7, from: "2026-10-04", to: "2026-10-10", previousFrom: "2026-09-27", previousTo: "2026-10-03" });

    const month = periods(30, new Date(2026, 2, 1)); // crosses February
    assert.equal(month.from, "2026-01-31");
    assert.equal(month.previousTo, "2026-01-30");
    assert.equal(daysBetween(month.from, month.to).length, 30);
});

test("daysBetween lists every day, oldest first, across a month boundary", () => {
    assert.deepEqual(daysBetween("2026-09-29", "2026-10-02"), ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    assert.deepEqual(daysBetween("2026-10-02", "2026-10-02"), ["2026-10-02"]);
});

test("change is a percentage of the previous period, and absent when there is nothing to compare", () => {
    assert.deepEqual(metric(150, 100), { value: 150, previous: 100, change_percent: 50 });
    assert.deepEqual(metric(50, 200), { value: 50, previous: 200, change_percent: -75 });
    assert.deepEqual(metric(10, 3), { value: 10, previous: 3, change_percent: 233.3 });
    assert.equal(metric(12, 0).change_percent, null); // not "infinite growth"
    assert.equal(metric(0, 0).change_percent, null);
});

// ======================= validation =======================

test("impression report: only a list of post ids is accepted, never who saw them", () => {
    const schema = validation.recordImpressionsSchema;
    assert.deepEqual(schema.parse({ post_ids: [3, 3, 7] }), { post_ids: [3, 7] }); // duplicates collapse
    assert.equal(schema.safeParse({ post_ids: [] }).success, false);
    assert.equal(schema.safeParse({ post_ids: ["3"] }).success, false);
    assert.equal(schema.safeParse({ post_ids: [-1] }).success, false);
    assert.equal(schema.safeParse({ post_ids: Array.from({ length: 51 }, (_, i) => i + 1) }).success, false);
    // forging the viewer is rejected outright
    assert.equal(schema.safeParse({ post_ids: [3], viewer_id: 9 }).success, false);
    assert.equal(schema.safeParse({ post_ids: [3], user_id: 9 }).success, false);
});

test("analytics queries: fixed ranges only, and no way to name another user", () => {
    assert.deepEqual(RANGES, [7, 30, 90]);
    assert.deepEqual(validation.overviewQuerySchema.parse({}), { days: 30 });
    assert.deepEqual(validation.overviewQuerySchema.parse({ days: "7" }), { days: 7 });
    assert.equal(validation.overviewQuerySchema.safeParse({ days: "365" }).success, false);
    assert.equal(validation.overviewQuerySchema.safeParse({ days: "7", user_id: "9" }).success, false);
    assert.equal(validation.viewersQuerySchema.safeParse({ user_id: "9" }).success, false);
    assert.equal(validation.postsQuerySchema.safeParse({ userId: "9" }).success, false);

    assert.deepEqual(validation.postsQuerySchema.parse({}), { days: 30, sort: "recent", page: 1, limit: 10 });
    assert.equal(validation.postsQuerySchema.parse({ sort: "impressions" }).sort, "impressions");
    assert.equal(validation.postsQuerySchema.safeParse({ sort: "created_at; DROP TABLE posts" }).success, false);
    assert.equal(validation.viewersQuerySchema.safeParse({ limit: "500" }).success, false);
});

// ======================= recording: post impressions =======================

test("impressions are recorded for the signed-in viewer", async () => {
    const result = await AnalyticsService.recordImpressions(student, [3, 7]);
    assert.deepEqual(recorded.recordImpressions.mock.calls[0].arguments, [5, [3, 7]]);
    assert.deepEqual(result, { recorded: true });
});

test("an admin browsing the feed is not an audience", async () => {
    assert.deepEqual(await AnalyticsService.recordImpressions(admin, [3]), { recorded: false });
    assert.equal(recorded.recordImpressions.mock.callCount(), 0);
});

test("SQL: an impression only counts for an ACTIVE post of someone else, once per day with a cap", async () => {
    mock.restoreAll();
    const calls = captureSql([{ affectedRows: 1 }]);
    await AnalyticsRepository.recordImpressions(5, [3, 7]);

    const { sql, params } = calls[0];
    assert.match(sql, /INSERT INTO post_impressions/);
    assert.match(sql, /p\.status = 'ACTIVE'/);
    assert.match(sql, /p\.user_id <> \?/); // your own post never counts
    assert.match(sql, /CURDATE\(\)/);
    assert.match(sql, new RegExp(`LEAST\\(views \\+ 1, ${CAPS.POST_VIEWS_PER_DAY}\\)`));
    assert.deepEqual(params, [5, 3, 7, 5]); // ids are bound, never concatenated

    calls.length = 0;
    assert.equal(await AnalyticsRepository.recordImpressions(5, []), 0);
    assert.equal(calls.length, 0);
});

// ======================= recording: profile views =======================

test("opening someone's profile records a view and tells them once", async () => {
    recorded.recordProfileView.mock.mockImplementation(async () => true); // first view today
    await AnalyticsService.trackProfileView(student, 9);

    assert.deepEqual(recorded.recordProfileView.mock.calls[0].arguments, [9, 5]);
    assert.equal(notify.notifyEvent.mock.callCount(), 1);
    const sent = notify.notifyEvent.mock.calls[0].arguments[0];
    assert.equal(sent.type, "PROFILE_VIEW");
    assert.equal(sent.recipientId, 9);
    assert.equal(sent.actorId, 5);
    assert.match(sent.dedupeKey, /^PROFILE_VIEW:5:\d{4}-\d{2}-\d{2}$/);
});

test("a second visit the same day is counted but does not notify again", async () => {
    recorded.recordProfileView.mock.mockImplementation(async () => false);
    await AnalyticsService.trackProfileView(student, 9);
    assert.equal(recorded.recordProfileView.mock.callCount(), 1);
    assert.equal(notify.notifyEvent.mock.callCount(), 0);
});

test("your own profile, an admin's visit and a junk id are never recorded", async () => {
    await AnalyticsService.trackProfileView(student, 5);
    await AnalyticsService.trackProfileView(student, "5");
    await AnalyticsService.trackProfileView(admin, 9);
    await AnalyticsService.trackProfileView(student, "abc");
    await AnalyticsService.trackProfileView(null, 9);
    assert.equal(recorded.recordProfileView.mock.callCount(), 0);
    assert.equal(notify.notifyEvent.mock.callCount(), 0);
});

test("a failure while recording never breaks the profile page", async () => {
    recorded.recordProfileView.mock.mockImplementation(async () => {
        throw new Error("database is down");
    });
    mock.method(console, "error", () => {});
    mock.method(ProfileRepository, "findPublicProfileById", async () => ({ user_id: 9, full_name: "Arjun Verma" }));

    const profile = await ProfileService.getPublicProfile(9, student);
    assert.equal(profile.full_name, "Arjun Verma");
});

test("getPublicProfile: a missing profile is a 404 and records nothing; no viewer means no tracking", async () => {
    mock.method(ProfileRepository, "findPublicProfileById", async () => undefined);
    await assert.rejects(ProfileService.getPublicProfile(9, student), { statusCode: 404 });
    assert.equal(recorded.recordProfileView.mock.callCount(), 0);

    mock.method(ProfileRepository, "findPublicProfileById", async () => ({ user_id: 9 }));
    await ProfileService.getPublicProfile(9);
    assert.equal(recorded.recordProfileView.mock.callCount(), 0);
    await ProfileService.getPublicProfile(9, student);
    assert.equal(recorded.recordProfileView.mock.callCount(), 1);
});

test("SQL: a profile view is one row per viewer per day; only the first one reports as new", async () => {
    mock.restoreAll();
    let affected = 1;
    const calls = captureSql(() => [{ affectedRows: affected }]);

    assert.equal(await AnalyticsRepository.recordProfileView(9, 5), true);
    affected = 2; // ON DUPLICATE KEY UPDATE
    assert.equal(await AnalyticsRepository.recordProfileView(9, 5), false);

    assert.match(calls[0].sql, /INSERT INTO profile_views \(profile_user_id, viewer_id, view_date, views\)/);
    assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE/);
    assert.deepEqual(calls[0].params, [9, 5]);
});

// ======================= recording: search appearances =======================

const person = (id) => ({ user_id: id, profile_id: id * 10, full_name: `Person ${id}`, role: "ALUMNI" });
function stubSearch(rows) {
    mock.method(SearchRepository, "searchPeople", async () => rows);
    mock.method(SearchRepository, "countPeople", async () => rows.length);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({}));
    mock.method(SearchRepository, "findOpenToForProfiles", async () => ({}));
    mock.method(SearchRepository, "searchPosts", async () => []);
    mock.method(SearchRepository, "countPosts", async () => 0);
}

test("the people a search lists get a search appearance from the searcher", async () => {
    stubSearch([person(9), person(12)]);
    await SearchService.search(5, searchQuerySchema.parse({ q: "arjun" }), "STUDENT");
    assert.deepEqual(recorded.recordSearchAppearances.mock.calls[0].arguments, [5, [9, 12]]);
});

test("filters count as a search too; just opening the directory does not", async () => {
    stubSearch([person(9)]);
    const run = (raw) => SearchService.search(5, searchQuerySchema.parse(raw), "STUDENT");

    await run({ type: "people" });
    await run({ type: "people", role: "ALUMNI" }); // the role tab alone is still just browsing
    await run({ type: "people", page: "2" });
    assert.equal(recorded.recordSearchAppearances.mock.callCount(), 0);

    await run({ type: "people", company: "Acme" });
    await run({ type: "people", skills: "React" });
    await run({ type: "people", openTo: "MENTORSHIP" });
    await run({ type: "people", batch: "2024" });
    assert.equal(recorded.recordSearchAppearances.mock.callCount(), 4);
});

test("searching posts, an empty result, yourself in the results and an admin's search record nothing extra", async () => {
    stubSearch([]);
    await SearchService.search(5, searchQuerySchema.parse({ q: "arjun" }), "STUDENT");
    await SearchService.search(5, searchQuerySchema.parse({ q: "arjun", type: "posts" }), "STUDENT");
    assert.equal(recorded.recordSearchAppearances.mock.callCount(), 0);

    stubSearch([person(5), person(9)]); // the searcher matches their own query
    await SearchService.search(5, searchQuerySchema.parse({ q: "person" }), "STUDENT");
    assert.deepEqual(recorded.recordSearchAppearances.mock.calls[0].arguments, [5, [9]]);

    await SearchService.search(1, searchQuerySchema.parse({ q: "person" }), "ADMIN");
    assert.equal(recorded.recordSearchAppearances.mock.callCount(), 1);
});

test("a failure while recording never breaks search", async () => {
    stubSearch([person(9)]);
    recorded.recordSearchAppearances.mock.mockImplementation(async () => {
        throw new Error("database is down");
    });
    mock.method(console, "error", () => {});
    const result = await SearchService.search(5, searchQuerySchema.parse({ q: "arjun" }), "STUDENT");
    assert.equal(result.people.length, 1);
});

test("SQL: a search appearance is only stored for ACTIVE members other than the searcher", async () => {
    mock.restoreAll();
    const calls = captureSql([{ affectedRows: 2 }]);
    await AnalyticsRepository.recordSearchAppearances(5, [9, 12]);
    assert.match(calls[0].sql, /INSERT INTO search_appearances/);
    assert.match(calls[0].sql, /u\.status = 'ACTIVE'/);
    assert.match(calls[0].sql, /u\.id <> \?/);
    assert.deepEqual(calls[0].params, [5, 9, 12, 5]);
});

// ======================= reading: overview =======================

function stubOverview({ current = {}, previous = {} } = {}) {
    const calls = { post: [], profile: [], search: [], series: [], audience: [] };
    const isCurrent = (from) => from === periods(7).from;
    mock.method(AnalyticsRepository, "postTotals", async (userId, from, to) => {
        calls.post.push({ userId, from, to });
        return isCurrent(from) ? { impressions: 200, reach: 40, likes: 12, comments: 8, ...current.post } : { impressions: 100, reach: 50, likes: 5, comments: 5, ...previous.post };
    });
    mock.method(AnalyticsRepository, "profileViewTotals", async (userId, from, to) => {
        calls.profile.push({ userId, from, to });
        return isCurrent(from) ? { views: 30, viewers: 12 } : { views: 0, viewers: 0 };
    });
    mock.method(AnalyticsRepository, "searchTotals", async (userId, from, to) => {
        calls.search.push({ userId, from, to });
        return isCurrent(from) ? { appearances: 18, searchers: 9 } : { appearances: 36, searchers: 12 };
    });
    mock.method(AnalyticsRepository, "dailySeries", async (userId, from, to) => {
        calls.series.push({ userId, from, to });
        return { impressions: { [to]: 25 }, profileViews: { [from]: 4 }, searches: {} };
    });
    mock.method(AnalyticsRepository, "audienceBreakdown", async (kind, userId) => {
        calls.audience.push({ kind, userId });
        return { roles: [{ label: "ALUMNI", people: 6 }, { label: "STUDENT", people: 3 }], companies: [{ label: "Acme Labs", people: 4 }], designations: [{ label: "Engineer", people: 2 }] };
    });
    return calls;
}

test("overview: totals, change against the previous period, and one point per day", async () => {
    stubOverview();
    const data = await AnalyticsService.getOverview(student, { days: 7 });
    const p = periods(7);

    assert.deepEqual(data.range, { days: 7, from: p.from, to: p.to, previous_from: p.previousFrom, previous_to: p.previousTo });
    assert.deepEqual(data.totals.post_impressions, { value: 200, previous: 100, change_percent: 100 });
    assert.deepEqual(data.totals.post_reach, { value: 40, previous: 50, change_percent: -20 });
    assert.deepEqual(data.totals.engagements, { value: 20, previous: 10, change_percent: 100 });
    assert.equal(data.totals.engagement_rate, 10); // 20 engagements / 200 impressions
    assert.deepEqual(data.totals.profile_views, { value: 30, previous: 0, change_percent: null });
    assert.deepEqual(data.totals.search_appearances, { value: 18, previous: 36, change_percent: -50 });
    assert.equal(data.totals.searchers.value, 9);

    assert.equal(data.series.length, 7);
    assert.deepEqual(data.series[0], { date: p.from, post_impressions: 0, profile_views: 4, search_appearances: 0 });
    assert.deepEqual(data.series[6], { date: p.to, post_impressions: 25, profile_views: 0, search_appearances: 0 });
    assert.deepEqual(data.definitions, DEFINITIONS);
});

test("overview: engagement rate is 0, not a division error, when nothing was seen", async () => {
    stubOverview({ current: { post: { impressions: 0, reach: 0, likes: 0, comments: 0 } } });
    const data = await AnalyticsService.getOverview(student, { days: 7 });
    assert.equal(data.totals.engagement_rate, 0);
});

test("authorization: every query is for the signed-in user and nobody else", async () => {
    const calls = stubOverview();
    await AnalyticsService.getOverview(alumnus, { days: 7 });
    for (const call of [...calls.post, ...calls.profile, ...calls.search, ...calls.series, ...calls.audience]) {
        assert.equal(call.userId, 9);
    }
    assert.deepEqual(calls.audience.map((c) => c.kind).sort(), ["profile", "search"]);
});

test("privacy: people who searched for you are only ever described as groups", async () => {
    stubOverview();
    const data = await AnalyticsService.getOverview(student, { days: 7 });
    const text = JSON.stringify({ searchers: data.searchers, profile_audience: data.profile_audience });
    assert.doesNotMatch(text, /user_id|full_name|email|enrollment|profile_photo/);
    assert.deepEqual(Object.keys(data.searchers).sort(), ["companies", "designations", "roles"]);
});

test("SQL: the audience breakdown counts ACTIVE people only and never selects an identity", async () => {
    mock.restoreAll();
    const calls = captureSql([[]]);
    await AnalyticsRepository.audienceBreakdown("search", 5, "2026-10-01", "2026-10-07");

    assert.equal(calls.length, 3);
    for (const { sql, params } of calls) {
        assert.match(sql, /FROM search_appearances v/);
        assert.match(sql, /vu\.status = 'ACTIVE'/);
        assert.match(sql, /COUNT\(DISTINCT v\.viewer_id\)/);
        assert.doesNotMatch(sql, /full_name|email|enrollment|SELECT v\.viewer_id/);
        assert.deepEqual(params, [5, "2026-10-01", "2026-10-07"]);
    }
    // companies and job titles describe alumni, not students' placeholder data
    assert.match(calls[1].sql, /vu\.role = 'ALUMNI'/);

    calls.length = 0;
    await AnalyticsRepository.audienceBreakdown("profile", 5, "2026-10-01", "2026-10-07");
    assert.match(calls[0].sql, /FROM profile_views v/);
    assert.match(calls[0].sql, /v\.profile_user_id = \?/);
});

// ======================= reading: my posts =======================

const postRow = (over = {}) => ({ id: 3, content: "Hello", created_at: "2026-10-01T10:00:00Z", media_count: 1, likes_count: 6, comments_count: 4, impressions: 200, reach: 80, period_impressions: 50, ...over });

test("post stats: numbers per post with an engagement rate", async () => {
    const find = mock.method(AnalyticsRepository, "findPostStats", async () => [postRow(), postRow({ id: 4, impressions: 0, reach: 0, likes_count: 0, comments_count: 0, period_impressions: 0 })]);
    mock.method(AnalyticsRepository, "countPosts", async () => 12);

    const data = await AnalyticsService.getPostStats(student, { days: 30, sort: "impressions", page: 2, limit: 5 });
    assert.equal(find.mock.calls[0].arguments[0], 5); // my posts only
    assert.deepEqual(find.mock.calls[0].arguments[3], { sort: "impressions", limit: 5, offset: 5 });
    assert.deepEqual(data.posts[0], { id: 3, content: "Hello", created_at: "2026-10-01T10:00:00Z", media_count: 1, impressions: 200, reach: 80, period_impressions: 50, likes: 6, comments: 4, engagement_rate: 5 });
    assert.equal(data.posts[1].engagement_rate, 0);
    assert.deepEqual(data.pagination, { page: 2, limit: 5, total: 12, totalPages: 3 });
    assert.equal(toPostStats(postRow({ impressions: "30", likes_count: "3", comments_count: "0" })).engagement_rate, 10);
});

test("SQL: post stats only ever read the given author's ACTIVE posts", async () => {
    mock.restoreAll();
    const calls = captureSql([[]]);
    await AnalyticsRepository.findPostStats(5, "2026-10-01", "2026-10-07", { sort: "impressions", limit: 10, offset: 0 });
    assert.match(calls[0].sql, /WHERE p\.user_id = \? AND p\.status = 'ACTIVE'/);
    assert.match(calls[0].sql, /ORDER BY impressions DESC/);
    assert.deepEqual(calls[0].params, ["2026-10-01", "2026-10-07", 5]);

    calls.length = 0;
    await AnalyticsRepository.findPostStats(5, "2026-10-01", "2026-10-07", { sort: "anything else", limit: 10, offset: 0 });
    assert.match(calls[0].sql, /ORDER BY p\.created_at DESC/); // unknown sort falls back, it is never interpolated
});

// ======================= reading: who viewed my profile =======================

const viewerRow = { user_id: 9, role: "ALUMNI", full_name: "Arjun Verma", profile_photo: null, company: "Acme", designation: "Engineer", branch: "CA", batch_year: 2024, views: "3", last_viewed_at: "2026-10-06T09:00:00Z", email: "arjun@x.com", enrollment: "2024107401", password_hash: "x" };

test("profile viewers: public fields only, with totals and pagination", async () => {
    const find = mock.method(AnalyticsRepository, "findProfileViewers", async () => [viewerRow]);
    mock.method(AnalyticsRepository, "profileViewTotals", async () => ({ views: 14, viewers: 11 }));

    const data = await AnalyticsService.getProfileViewers(student, { days: 30, page: 1, limit: 10 });
    assert.equal(find.mock.calls[0].arguments[0], 5);
    assert.deepEqual(data.viewers[0], {
        user_id: 9, full_name: "Arjun Verma", profile_photo: null, role: "ALUMNI", company: "Acme", designation: "Engineer",
        branch: "CA", batch_year: 2024, is_verified_alumni: true, views: 3, last_viewed_at: "2026-10-06T09:00:00Z",
    });
    assert.doesNotMatch(JSON.stringify(data), /email|enrollment|password/);
    assert.equal(data.total_views, 14);
    assert.deepEqual(data.pagination, { page: 1, limit: 10, total: 11, totalPages: 2 });
    assert.equal(toPublicViewer({ user_id: 2, role: "STUDENT", views: 1 }).full_name, "SRMS Member");
});

test("SQL: profile viewers are ACTIVE members who viewed THIS user's profile", async () => {
    mock.restoreAll();
    const calls = captureSql([[]]);
    await AnalyticsRepository.findProfileViewers(5, "2026-10-01", "2026-10-07", { limit: 10, offset: 20 });
    assert.match(calls[0].sql, /v\.profile_user_id = \?/);
    assert.match(calls[0].sql, /vu\.status = 'ACTIVE'/);
    assert.match(calls[0].sql, /LIMIT 10 OFFSET 20/);
    assert.doesNotMatch(calls[0].sql, /email|enrollment|password/);
    assert.deepEqual(calls[0].params, [5, "2026-10-01", "2026-10-07"]);
});

// ======================= posts on a profile =======================

test("my posts: always the session user's own, each with its numbers", async () => {
    const rows = [{ id: 3, user_id: 5, content: "Mine" }, { id: 4, user_id: 5, content: "Also mine" }];
    const find = mock.method(PostRepository, "findByUser", async () => rows);
    const count = mock.method(PostRepository, "countByUser", async () => 12);
    mock.method(AnalyticsRepository, "findImpressionsForPosts", async () => ({ 3: { impressions: 40, reach: 22 } }));

    const mine = await PostService.getMyPosts(5, 2, 10);
    assert.deepEqual(mine.posts[0].analytics, { impressions: 40, reach: 22 });
    assert.deepEqual(mine.posts[1].analytics, { impressions: 0, reach: 0 });
    assert.deepEqual(find.mock.calls[0].arguments, [5, 5, 10, 10]); // author = viewer = the session user
    assert.deepEqual(count.mock.calls[0].arguments, [5]);
    assert.deepEqual(mine.pagination, { page: 2, limit: 10, total: 12, totalPages: 2 });

    // there is no method left that lists another member's posts
    assert.equal(PostService.getUserPosts, undefined);
});

test("SQL: a member's posts are only ACTIVE posts of an ACTIVE account", async () => {
    mock.restoreAll();
    const calls = captureSql([[]]);
    await PostRepository.findByUser(9, 5, 10, 0);
    assert.match(calls[0].sql, /u\.status = 'ACTIVE'/);
    assert.match(calls[0].sql, /p\.status = 'ACTIVE'/);
    assert.match(calls[0].sql, /p\.deleted_at IS NULL/);
    assert.deepEqual(calls[0].params, [9, 5]);
});

// ======================= notification type =======================

test("PROFILE_VIEW is a known notification type", () => {
    assert.equal(NotificationService.TYPES.PROFILE_VIEW, "PROFILE_VIEW");
});

// ======================= HTTP =======================

let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/posts", postRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const bearer = (userId = 5, role = "STUDENT") => ({ Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`, "Content-Type": "application/json" });
const liveSession = (userId = 5, role = "STUDENT", status = "ACTIVE") =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role, status }));

test("HTTP: every analytics route needs a signed-in, ACTIVE user", async () => {
    for (const path of ["/analytics/overview", "/analytics/posts", "/analytics/profile-viewers", "/posts/mine"]) {
        assert.equal((await fetch(base + path)).status, 401, path);
    }
    assert.equal((await fetch(`${base}/analytics/impressions`, { method: "POST", body: "{}" })).status, 401);

    liveSession(5, "STUDENT", "BLOCKED");
    assert.equal((await fetch(`${base}/analytics/overview`, { headers: bearer() })).status, 401);
});

test("HTTP: the overview is the caller's own; a user id in the query is refused", async () => {
    liveSession(5);
    const calls = stubOverview();

    const ok = await fetch(`${base}/analytics/overview?days=7`, { headers: bearer(5) });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.data.totals.post_impressions.value, 200);
    assert.equal(calls.post.every((c) => c.userId === 5), true);

    assert.equal((await fetch(`${base}/analytics/overview?days=7&user_id=9`, { headers: bearer(5) })).status, 400);
    assert.equal((await fetch(`${base}/analytics/overview?days=1000`, { headers: bearer(5) })).status, 400);
    assert.equal((await fetch(`${base}/analytics/profile-viewers?user_id=9`, { headers: bearer(5) })).status, 400);
});

test("HTTP: impressions are recorded for the session's user, whatever the body claims", async () => {
    liveSession(5);
    const res = await fetch(`${base}/analytics/impressions`, { method: "POST", headers: bearer(5), body: JSON.stringify({ post_ids: [3, 7] }) });
    assert.equal(res.status, 200);
    assert.deepEqual(recorded.recordImpressions.mock.calls[0].arguments, [5, [3, 7]]);

    const forged = await fetch(`${base}/analytics/impressions`, { method: "POST", headers: bearer(5), body: JSON.stringify({ post_ids: [3], viewer_id: 9 }) });
    assert.equal(forged.status, 400);
    assert.equal(recorded.recordImpressions.mock.callCount(), 1);
});

test("HTTP: GET /posts/mine is the caller's own list; another member's posts cannot be requested", async () => {
    liveSession(9, "ALUMNI");
    const find = mock.method(PostRepository, "findByUser", async () => [{ id: 3, user_id: 9, content: "Hi" }]);
    mock.method(PostRepository, "countByUser", async () => 1);
    mock.method(AnalyticsRepository, "findImpressionsForPosts", async () => ({}));

    const res = await fetch(`${base}/posts/mine?limit=5`, { headers: bearer(9, "ALUMNI") });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.posts.length, 1);
    assert.deepEqual(find.mock.calls[0].arguments, [9, 9, 5, 0]);

    // a user id in the query changes nothing, and the old per-user URL is gone
    await fetch(`${base}/posts/mine?limit=5&userId=5&user_id=5`, { headers: bearer(9, "ALUMNI") });
    assert.deepEqual(find.mock.calls[1].arguments, [9, 9, 5, 0]);
    assert.equal((await fetch(`${base}/posts/user/5`, { headers: bearer(9, "ALUMNI") })).status, 404);
    assert.equal(find.mock.callCount(), 2);
});
