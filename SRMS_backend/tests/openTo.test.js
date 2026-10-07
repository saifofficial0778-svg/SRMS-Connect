process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const ProfileRepository = require("../src/modules/profile/profile.repository");
const ProfileService = require("../src/modules/profile/profile.service");
const profileRoutes = require("../src/modules/profile/profile.route");
const { updateOpenToSchema } = require("../src/modules/profile/profile.validation");
const { OPEN_TO_INTENTS } = require("../src/modules/profile/profile.constants");
const SearchRepository = require("../src/modules/search/search.repository");
const SearchService = require("../src/modules/search/search.service");
const { searchQuerySchema } = require("../src/modules/search/search.validation");
const qb = require("../src/modules/search/search.queryBuilder");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");

const stubAnalytics = require("./helpers/stubAnalytics");

// searching and opening a profile also record analytics; never let a test reach the real database
beforeEach(() => stubAnalytics(mock));
afterEach(() => mock.restoreAll());

// ======================= validation =======================

test("the supported intents", () => {
    assert.deepEqual(OPEN_TO_INTENTS, ["MENTORSHIP", "REFERRALS", "RESUME_REVIEW", "MOCK_INTERVIEW", "HIRING"]);
});

test("open-to payload: valid sets pass, junk is rejected", () => {
    const ok = (body) => updateOpenToSchema.safeParse(body).success;
    assert.equal(ok({ intents: [] }), true); // "not open to anything"
    assert.equal(ok({ intents: ["MENTORSHIP", "HIRING"] }), true);
    assert.equal(ok({ intents: OPEN_TO_INTENTS }), true);
    assert.equal(ok({ intents: ["MENTORSHIP", "MENTORSHIP"] }), false); // duplicates
    assert.equal(ok({ intents: ["DATING"] }), false);
    assert.equal(ok({ intents: "MENTORSHIP" }), false);
    assert.equal(ok({}), false);
    assert.equal(ok({ intents: [], role: "ALUMNI" }), false); // no extra fields
});

// ======================= service =======================

test("a student can pick any intent except Hiring", async () => {
    mock.method(ProfileRepository, "findProfileByUserId", async () => ({ id: 40, user_id: 1 }));
    const replace = mock.method(ProfileRepository, "replaceOpenTo", async () => {});

    await assert.rejects(ProfileService.updateOpenTo(1, "STUDENT", ["HIRING"]), { statusCode: 403 });
    await assert.rejects(ProfileService.updateOpenTo(1, "STUDENT", ["MENTORSHIP", "HIRING"]), { statusCode: 403 });
    assert.equal(replace.mock.callCount(), 0);

    const result = await ProfileService.updateOpenTo(1, "STUDENT", ["RESUME_REVIEW", "MOCK_INTERVIEW"]);
    assert.deepEqual(result, { open_to: ["RESUME_REVIEW", "MOCK_INTERVIEW"] });
    assert.deepEqual(replace.mock.calls[0].arguments, [40, ["RESUME_REVIEW", "MOCK_INTERVIEW"]]);
});

test("an alumnus can be Hiring; saving replaces the whole set", async () => {
    mock.method(ProfileRepository, "findProfileByUserId", async () => ({ id: 41, user_id: 10 }));
    const replace = mock.method(ProfileRepository, "replaceOpenTo", async () => {});

    await ProfileService.updateOpenTo(10, "ALUMNI", ["HIRING", "REFERRALS"]);
    await ProfileService.updateOpenTo(10, "ALUMNI", []);

    assert.deepEqual(replace.mock.calls.map((c) => c.arguments), [[41, ["HIRING", "REFERRALS"]], [41, []]]);
});

test("a user without a profile gets a 404", async () => {
    mock.method(ProfileRepository, "findProfileByUserId", async () => undefined);
    await assert.rejects(ProfileService.updateOpenTo(9, "ALUMNI", []), { statusCode: 404 });
});

// ======================= repository =======================

test("saving replaces the set atomically and rolls back on failure", async () => {
    const log = [];
    const connection = {
        beginTransaction: async () => log.push("begin"),
        commit: async () => log.push("commit"),
        rollback: async () => log.push("rollback"),
        release: () => log.push("release"),
        execute: async (sql, params) => {
            log.push(sql.replace(/\s+/g, " ").split(" ").slice(0, 3).join(" ") + ":" + params.join(","));
            if (params[1] === "REFERRALS") throw new Error("boom");
            return [{}];
        },
    };
    mock.method(pool, "getConnection", async () => connection);

    await ProfileRepository.replaceOpenTo(41, ["MENTORSHIP"]);
    assert.deepEqual(log, ["begin", "DELETE FROM profile_open_to:41", "INSERT INTO profile_open_to:41,MENTORSHIP", "commit", "release"]);

    log.length = 0;
    await assert.rejects(ProfileRepository.replaceOpenTo(41, ["MENTORSHIP", "REFERRALS"]), /boom/);
    assert.ok(log.includes("rollback"));
    assert.equal(log.includes("commit"), false);
});

test("own and public profiles include open_to", async () => {
    mock.method(pool, "execute", async (sql) => {
        if (sql.includes("FROM profile_open_to")) return [[{ intent: "MENTORSHIP" }, { intent: "HIRING" }], []];
        if (sql.includes("FROM profiles p")) return [[{ id: 41, user_id: 10, full_name: "Arjun" }], []];
        return [[], []]; // skills / projects
    });

    assert.deepEqual((await ProfileRepository.findProfileByUserId(10)).open_to, ["MENTORSHIP", "HIRING"]);
    assert.deepEqual((await ProfileRepository.findPublicProfileById(10)).open_to, ["MENTORSHIP", "HIRING"]);
});

// ======================= search integration =======================

test("search: the openTo filter is validated and bound as a parameter", () => {
    assert.equal(searchQuerySchema.parse({ type: "people", openTo: "HIRING" }).openTo, "HIRING");
    assert.equal(searchQuerySchema.parse({ type: "people", openTo: "" }).openTo, undefined);
    assert.equal(searchQuerySchema.safeParse({ type: "people", openTo: "DATING" }).success, false);

    const { whereSql, params } = qb.buildPeopleFilter({ viewerId: 1, openTo: "MENTORSHIP" });
    assert.match(whereSql, /EXISTS \(SELECT 1 FROM profile_open_to po WHERE po\.profile_id = p\.id AND po\.intent = \?\)/);
    assert.deepEqual(params, [1, "MENTORSHIP"]);
    assert.equal(qb.buildPeopleFilter({ viewerId: 1 }).whereSql.includes("profile_open_to"), false);
});

test("search results carry each person's open_to, passed through to the filter", async () => {
    const search = mock.method(SearchRepository, "searchPeople", async () => [
        { profile_id: 5, user_id: 7, full_name: "Asha", role: "ALUMNI" },
        { profile_id: 6, user_id: 8, full_name: "Ravi", role: "STUDENT" },
    ]);
    mock.method(SearchRepository, "countPeople", async () => 2);
    mock.method(SearchRepository, "findSkillsForProfiles", async () => ({}));
    mock.method(SearchRepository, "findOpenToForProfiles", async () => ({ 5: ["HIRING", "MENTORSHIP"] }));

    const { people } = await SearchService.search(1, searchQuerySchema.parse({ type: "people", openTo: "HIRING" }));

    assert.equal(search.mock.calls[0].arguments[0].openTo, "HIRING");
    assert.deepEqual(people[0].open_to, ["HIRING", "MENTORSHIP"]);
    assert.deepEqual(people[1].open_to, []); // nothing selected
});

// ======================= HTTP =======================

let server, base;

before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/profile", profileRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/profile/open-to`;
});
after(() => server.close());

const put = (body, tokenRole = "ALUMNI") =>
    fetch(base, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${jwt.sign({ userId: 5, role: tokenRole }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

test("HTTP: updating open-to needs a signed-in user", async () => {
    const res = await fetch(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(res.status, 401);
});

test("HTTP: save, validate, and enforce 'Hiring is alumni-only' from the session role", async () => {
    mock.method(ProfileRepository, "findProfileByUserId", async () => ({ id: 40, user_id: 5 }));
    const replace = mock.method(ProfileRepository, "replaceOpenTo", async () => {});

    // session says STUDENT, even though the token claims ALUMNI
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 5, role: "STUDENT", status: "ACTIVE" }));
    assert.equal((await put({ intents: ["HIRING"] }, "ALUMNI")).status, 403);
    assert.equal(replace.mock.callCount(), 0);

    const ok = await put({ intents: ["MENTORSHIP"] });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).data, { open_to: ["MENTORSHIP"] });

    assert.equal((await put({ intents: ["NOPE"] })).status, 400);
    assert.equal((await put({ intents: ["MENTORSHIP", "MENTORSHIP"] })).status, 400);
    assert.equal(replace.mock.callCount(), 1);
});
