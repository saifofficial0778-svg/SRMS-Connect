process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const SearchRepository = require("../src/modules/search/search.repository");
const SearchService = require("../src/modules/search/search.service");
const ProfileRepository = require("../src/modules/profile/profile.repository");
const { searchQuerySchema } = require("../src/modules/search/search.validation");
const qb = require("../src/modules/search/search.queryBuilder");
const searchRoutes = require("../src/modules/search/search.route");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");

const stubSkills = require("./helpers/stubSkills");
const stubAnalytics = require("./helpers/stubAnalytics");

// the service also loads each result's "Open to" intents; never let a test reach the real database
beforeEach(() => {
    stubSkills(mock);
    stubAnalytics(mock);
    mock.method(SearchRepository, "findOpenToForProfiles", async () => ({}));
});
afterEach(() => mock.restoreAll());

const parse = (raw) => searchQuerySchema.safeParse(raw);

// ======================= query builder =======================

test("escapeLike neutralises LIKE wildcards and backslashes", () => {
    assert.equal(qb.escapeLike("100%_done\\"), "100\\%\\_done\\\\");
});

test("splitTerms trims, splits on whitespace and caps at 5 words", () => {
    assert.deepEqual(qb.splitTerms("  Sai   Kumar "), ["Sai", "Kumar"]);
    assert.equal(qb.splitTerms("a b c d e f g").length, 5);
    assert.deepEqual(qb.splitTerms(undefined), []);
});

test("people filter always limits to ACTIVE students/alumni and excludes the viewer", () => {
    const { whereSql, params } = qb.buildPeopleFilter({ viewerId: 42 });
    assert.match(whereSql, /u\.status = 'ACTIVE'/);
    assert.match(whereSql, /u\.role IN \('STUDENT', 'ALUMNI'\)/);
    assert.match(whereSql, /p\.user_id <> \?/);
    assert.deepEqual(params, [42]);
});

test("people filter maps every filter to a bound parameter (never string-built)", () => {
    const evil = "x'; DROP TABLE users; --";
    const { whereSql, params } = qb.buildPeopleFilter({
        viewerId: 1, q: "sai", role: "ALUMNI", company: evil, designation: "dev", branch: "CA", batch: 2024, skills: ["React", "Node"],
    });

    assert.equal(whereSql.includes("DROP"), false);
    assert.ok(params.includes(`%${evil}%`));
    assert.match(whereSql, /u\.role = \?/);
    assert.match(whereSql, /p\.company LIKE \?/);
    assert.match(whereSql, /p\.designation LIKE \?/);
    assert.match(whereSql, /p\.branch = \?/);
    assert.match(whereSql, /p\.batch_year = \?/);
    assert.equal((whereSql.match(/ps\.skill_key IN \(\?\)/g) || []).length, 2); // each skill required
    assert.ok(params.includes("react") && params.includes("node")); // matched on the normalized key
    assert.equal((whereSql.match(/\?/g) || []).length, params.length);
});

test("free text: every word must match name/company/designation/skill, wildcards escaped", () => {
    const { whereSql, params } = qb.buildPeopleFilter({ viewerId: 1, q: "sai 50%" });
    assert.equal((whereSql.match(/p\.full_name LIKE \?/g) || []).length, 2);
    assert.ok(params.includes("%50\\%%"));
});

test("name matches are ranked before other matches", () => {
    const { orderSql, params } = qb.buildPeopleOrder("sai");
    assert.match(orderSql, /CASE WHEN p\.full_name LIKE \? THEN 0 WHEN p\.full_name LIKE \? THEN 1 ELSE 2 END/);
    assert.deepEqual(params, ["sai%", "% sai%"]);
    assert.deepEqual(qb.buildPeopleOrder(undefined).params, []);
});

test("posts: full-text for long words, LIKE fallback for short words and stopwords", () => {
    const ft = qb.buildPostFilter("internship google");
    assert.match(ft.whereSql, /MATCH\(po\.content\) AGAINST \(\? IN BOOLEAN MODE\)/);
    assert.deepEqual(ft.params, ["+internship* +google*"]);

    for (const q of ["ab", "the", "my dsa"]) {
        const like = qb.buildPostFilter(q);
        assert.equal(like.whereSql.includes("MATCH"), false, q);
        assert.match(like.whereSql, /po\.content LIKE \?/);
    }
});

test("posts: only ACTIVE posts by ACTIVE authors are searchable", () => {
    const { whereSql } = qb.buildPostFilter("hello");
    assert.match(whereSql, /po\.status = 'ACTIVE'/);
    assert.match(whereSql, /po\.deleted_at IS NULL/);
    assert.match(whereSql, /u\.status = 'ACTIVE'/);
});

test("boolean-mode operators are stripped from user input", () => {
    assert.equal(qb.toBooleanQuery(['"foo', "-bar", "@baz", "(qux)*"]), "+foo* +bar* +baz* +qux*");
});

// ======================= validation =======================

test("validation: defaults, coercion and blank fields", () => {
    const r = parse({ q: "sai", company: "", batch: "2024", page: "", limit: "20" });
    assert.equal(r.success, true);
    assert.equal(r.data.type, "all");
    assert.equal(r.data.company, undefined);
    assert.equal(r.data.batch, 2024);
    assert.equal(r.data.page, 1);
    assert.equal(r.data.limit, 20);
});

test("validation: skills are split, trimmed and capped at 5", () => {
    const r = parse({ type: "people", skills: " React , Node,, a,b,c,d " });
    assert.deepEqual(r.data.skills, ["React", "Node", "a", "b", "c"]);
});

test("validation: rejects bad role, short query, oversized page/limit, bad batch", () => {
    assert.equal(parse({ q: "sai", role: "ADMIN" }).success, false); // admins are not searchable
    assert.equal(parse({ q: "a" }).success, false);
    assert.equal(parse({ q: "sai", limit: "500" }).success, false);
    assert.equal(parse({ q: "sai", page: "0" }).success, false);
    assert.equal(parse({ type: "people", batch: "abc" }).success, false);
    assert.equal(parse({ q: "sai", type: "jobs" }).success, false);
});

test("validation: global/post search needs a query, the people directory does not", () => {
    assert.equal(parse({}).success, false);
    assert.equal(parse({ type: "posts" }).success, false);
    assert.equal(parse({ type: "people" }).success, true);
    assert.equal(parse({ type: "people", role: "ALUMNI", branch: "CA" }).success, true);
});

// ======================= service: privacy, pagination =======================

// a row as if a careless query had selected sensitive columns too
const dirtyRow = (over = {}) => ({
    profile_id: 100,
    user_id: 7,
    full_name: "Asha Rao",
    profile_photo: "p.jpg",
    bio: "hi",
    location: "Delhi",
    company: "Acme",
    designation: "Engineer",
    experience_years: "3.0",
    branch: "CA",
    batch_year: 2020,
    role: "ALUMNI",
    email: "asha@secret.test",
    enrollment: "EN123",
    mobile: "9999999999",
    dob: "2000-01-01",
    password_hash: "$2a$secret",
    resume_url: "r.pdf",
    interests: "x",
    career_goals: "y",
    status: "ACTIVE",
    last_login: "2026-01-01",
    ...over,
});

const parsed = (raw) => searchQuerySchema.parse(raw);

test("service: only whitelisted public fields leave the API", async () => {
    mock.method(SearchRepository, "searchPeople", async () => [dirtyRow()]);
    mock.method(SearchRepository, "countPeople", async () => 1);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({ 100: ["React"] }));

    const { people } = await SearchService.search(1, parsed({ type: "people" }));

    assert.deepEqual(Object.keys(people[0]).sort(), [
        "batch_year", "bio", "branch", "company", "designation", "experience_years", "full_name",
        "is_verified_alumni", "location", "open_to", "profile_photo", "role", "skills", "user_id",
    ]);
    const json = JSON.stringify(people);
    for (const secret of ["asha@secret.test", "EN123", "9999999999", "2000-01-01", "$2a$secret", "r.pdf", "profile_id"]) {
        assert.equal(json.includes(secret), false, `${secret} leaked`);
    }
});

test("service: only alumni are flagged as Verified Alumni, skills attached and capped", async () => {
    const skills = ["a", "b", "c", "d", "e", "f", "g", "h"];
    mock.method(SearchRepository, "searchPeople", async () => [
        dirtyRow({ profile_id: 1, user_id: 1, role: "ALUMNI" }),
        dirtyRow({ profile_id: 2, user_id: 2, role: "STUDENT" }),
    ]);
    mock.method(SearchRepository, "countPeople", async () => 2);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({ 1: skills }));

    const { people } = await SearchService.search(9, parsed({ type: "people" }));

    assert.equal(people[0].is_verified_alumni, true);
    assert.equal(people[1].is_verified_alumni, false);
    assert.equal(people[0].skills.length, 6);
    assert.deepEqual(people[1].skills, []);
});

test("service: pagination maths, offset, default limits and viewer exclusion", async () => {
    const search = mock.method(SearchRepository, "searchPeople", async () => []);
    mock.method(SearchRepository, "countPeople", async () => 25);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({}));

    const r = await SearchService.search(77, parsed({ type: "people", page: "3" }));

    const [filters, limit, offset] = search.mock.calls[0].arguments;
    assert.equal(filters.viewerId, 77);
    assert.equal(limit, 12); // directory default
    assert.equal(offset, 24);
    assert.deepEqual(r.pagination, { page: 3, limit: 12, total: 25, totalPages: 3 });

    mock.method(SearchRepository, "searchPosts", async () => []);
    await SearchService.search(77, parsed({ type: "all", q: "sai" }));
    assert.equal(search.mock.calls[1].arguments[1], 5); // navbar default
});

test("service: filters are passed through to the repository", async () => {
    const search = mock.method(SearchRepository, "searchPeople", async () => []);
    mock.method(SearchRepository, "countPeople", async () => 0);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({}));

    const r = await SearchService.search(1, parsed({
        type: "people", q: "sai", role: "ALUMNI", company: "Wipro", designation: "dev", branch: "CA", batch: "2024", skills: "React,Node",
    }));

    assert.deepEqual(search.mock.calls[0].arguments[0], {
        viewerId: 1, q: "sai", role: "ALUMNI", company: "Wipro", designation: "dev", branch: "CA", batch: 2024, skills: ["React", "Node"],
        // every spelling that means React / Node.js (from the alias table)
        skillKeyGroups: [["react", "reactjs"], ["nodejs", "node"]],
        openTo: undefined,
    });
    assert.deepEqual(r.pagination, { page: 1, limit: 12, total: 0, totalPages: 1 });
});

test("service: type=people never queries posts; type=posts never queries people", async () => {
    const people = mock.method(SearchRepository, "searchPeople", async () => []);
    mock.method(SearchRepository, "countPeople", async () => 0);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({}));
    const posts = mock.method(SearchRepository, "searchPosts", async () => [
        { id: 1, user_id: 2, content: "hello", created_at: "t", full_name: "A", profile_photo: null, status: "ACTIVE" },
    ]);
    mock.method(SearchRepository, "countPosts", async () => 1);

    await SearchService.search(1, parsed({ type: "people" }));
    assert.equal(posts.mock.callCount(), 0);

    const r = await SearchService.search(1, parsed({ type: "posts", q: "hello" }));
    assert.equal(people.mock.callCount(), 1); // still just the first call
    assert.deepEqual(Object.keys(r.posts[0]).sort(), ["content", "created_at", "full_name", "id", "profile_photo", "user_id"]);
    assert.equal(r.pagination.total, 1);
});

// ======================= repositories: the SQL that actually runs =======================

function captureSql() {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql, params });
        return [[{ total: 0 }]];
    });
    return calls;
}

test("people SQL selects no private columns and restricts to ACTIVE users", async () => {
    const calls = captureSql();
    await SearchRepository.searchPeople({ viewerId: 1, q: "sai" }, 12, 0);

    const { sql } = calls[0];
    const selectList = sql.slice(sql.indexOf("SELECT"), sql.indexOf("FROM profiles"));
    for (const col of ["email", "enrollment", "mobile", "dob", "password", "resume_url", "interests", "career_goals", "last_login", "u.status", "linkedin"]) {
        assert.equal(selectList.includes(col), false, `${col} must not be selected`);
    }
    assert.match(sql, /u\.status = 'ACTIVE'/);
    assert.match(sql, /LIMIT 12 OFFSET 0/);
});

test("the directory cannot search by enrollment, email or phone (not matchable fields)", () => {
    const { whereSql } = qb.buildPeopleFilter({ viewerId: 1, q: "EN123" });
    for (const col of ["enrollment", "email", "mobile", "dob"]) {
        assert.equal(whereSql.includes(col), false, `${col} must not be searchable`);
    }
});

test("public profile (used after clicking a result) is only served for ACTIVE users", async () => {
    const calls = captureSql();
    await ProfileRepository.findPublicProfileById(5);
    assert.match(calls[0].sql, /u\.status = 'ACTIVE'/);
    assert.equal(/resume_url|interests|career_goals|email|enrollment/.test(calls[0].sql), false);
});

// ======================= HTTP: auth, validation, response shape =======================

let server, base;

before(async () => {
    const app = express();
    app.use("/api/search", searchRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/search`;
});
after(() => server.close());

const bearer = () => ({ Authorization: `Bearer ${jwt.sign({ userId: 5, role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" })}` });
const liveSession = () =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 5, role: "STUDENT", status: "ACTIVE" }));

test("HTTP: search requires a signed-in user", async () => {
    assert.equal((await fetch(`${base}?q=sai`)).status, 401);
    assert.equal((await fetch(`${base}/filters`)).status, 401);
});

test("HTTP: a blocked user's token cannot search", async () => {
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 5, role: "STUDENT", status: "BLOCKED" }));
    assert.equal((await fetch(`${base}?q=sai`, { headers: bearer() })).status, 401);
});

test("HTTP: invalid query is a 400 with validation details", async () => {
    liveSession();
    const res = await fetch(`${base}?q=a&role=ADMIN`, { headers: bearer() });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, "Validation failed");
});

test("HTTP: valid search returns people, posts and pagination for the signed-in viewer", async () => {
    liveSession();
    const people = mock.method(SearchRepository, "searchPeople", async () => [dirtyRow()]);
    mock.method(SearchRepository, "countPeople", async () => 1);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({ 100: ["React"] }));
    mock.method(SearchRepository, "searchPosts", async () => []);

    const res = await fetch(`${base}?q=asha&type=all`, { headers: bearer() });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.people[0].full_name, "Asha Rao");
    assert.equal(body.data.people[0].is_verified_alumni, true);
    assert.deepEqual(body.data.posts, []);
    assert.equal(body.data.pagination.total, 1);
    assert.equal(people.mock.calls[0].arguments[0].viewerId, 5); // viewer comes from the token, not the URL
    assert.equal(JSON.stringify(body).includes("asha@secret.test"), false);
});

test("HTTP: filters endpoint returns dropdown values", async () => {
    liveSession();
    mock.method(SearchRepository, "getFilterOptions", async () => ({ branches: ["CA"], batchYears: [2025, 2024] }));

    const body = await (await fetch(`${base}/filters`, { headers: bearer() })).json();
    assert.deepEqual(body.data, { branches: ["CA"], batchYears: [2025, 2024] });
});
