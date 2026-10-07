process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.RATE_LIMIT_DISABLED = "true";

const { test, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const SpotlightRepository = require("../src/modules/spotlight/spotlight.repository");
const SpotlightService = require("../src/modules/spotlight/spotlight.service");
const { toPublicSpotlight, toAdminSpotlight } = SpotlightService;
const { createSpotlightSchema, updateSpotlightSchema, setStatusSchema, adminListSchema } = require("../src/modules/spotlight/spotlight.validation");
const spotlightRoutes = require("../src/modules/spotlight/spotlight.route");
const ConnectionRepository = require("../src/modules/connection/connection.repository");
const ConnectionService = require("../src/modules/connection/connection.service");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");

afterEach(() => mock.restoreAll());

const admin = { userId: 4, role: "ADMIN" };
const student = { userId: 5, role: "STUDENT" };
const alumnus = { userId: 9, role: "ALUMNI" };

const row = (over = {}) => ({
    id: 3, title: "Placement Drive", description: "Twelve companies are visiting.", category: "PLACEMENT", image_url: null,
    starts_at: "2026-11-05T09:30", ends_at: null, location: "Block A", is_online: 0, cta_label: null, cta_url: null,
    status: "PUBLISHED", publish_at: null, is_scheduled: 0, is_over: 0, created_by: 4, created_at: "x", updated_at: "y", ...over,
});
const valid = (over = {}) => ({ title: "Placement Drive", description: "Twelve companies are visiting.", ...over });

function captureSql(result = [[]]) {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql: String(sql).replace(/\s+/g, " "), params });
        return result;
    });
    return calls;
}

// ======================= validation =======================

test("create: sensible defaults, and a draft unless told otherwise", () => {
    const parsed = createSpotlightSchema.parse(valid());
    assert.equal(parsed.status, "DRAFT");
    assert.equal(parsed.category, "EVENT");
    assert.equal(parsed.is_online, false);
    assert.deepEqual([parsed.image_url, parsed.starts_at, parsed.cta_url, parsed.publish_at], [null, null, null, null]);
});

test("create: text limits, known categories, real dates in the expected format", () => {
    const ok = (body) => createSpotlightSchema.safeParse(body).success;
    assert.equal(ok(valid({ title: "abc" })), false);
    assert.equal(ok(valid({ description: "too short" })), false);
    assert.equal(ok(valid({ description: "x".repeat(601) })), false);
    assert.equal(ok(valid({ category: "PARTY" })), false);
    assert.equal(ok(valid({ status: "LIVE" })), false);
    assert.equal(ok(valid({ starts_at: "2026-11-05T09:30" })), true);
    assert.equal(ok(valid({ starts_at: "05/11/2026" })), false);
    assert.equal(ok(valid({ starts_at: "2026-13-45T09:30" })), false);
    assert.equal(ok(valid({ starts_at: "2026-11-05T09:30", ends_at: "2026-11-05T08:00" })), false);
    assert.equal(ok(valid({ starts_at: "", location: "  " })), true); // emptied fields mean "none"
});

test("links that every member will open must be https, and a button needs both parts", () => {
    const ok = (body) => createSpotlightSchema.safeParse(body).success;
    for (const bad of ["http://example.com/a.png", "javascript:alert(1)", "data:text/html,x", "https://user:pw@example.com/a"]) {
        assert.equal(ok(valid({ image_url: bad })), false, bad);
        assert.equal(ok(valid({ cta_label: "Register", cta_url: bad })), false, bad);
    }
    assert.equal(ok(valid({ image_url: "https://example.com/banner.png", cta_label: "Register", cta_url: "https://example.com/r" })), true);
    assert.equal(ok(valid({ cta_label: "Register" })), false);
    assert.equal(ok(valid({ cta_url: "https://example.com/r" })), false);
});

test("the author can never be supplied, and unknown fields are rejected", () => {
    assert.equal(createSpotlightSchema.safeParse(valid({ created_by: 9 })).success, false);
    assert.equal(updateSpotlightSchema.safeParse({ created_by: 9 }).success, false);
    assert.equal(updateSpotlightSchema.safeParse({}).success, false);
    assert.equal(setStatusSchema.safeParse({ status: "PUBLISHED", id: 9 }).success, false);
    assert.equal(adminListSchema.safeParse({ status: "DELETED" }).success, false);
    assert.deepEqual(adminListSchema.parse({}), { page: 1, limit: 20 });
});

test("update: only the fields that were sent change; an emptied field becomes null", () => {
    assert.deepEqual(updateSpotlightSchema.parse({ title: "New title here" }), { title: "New title here" });
    assert.deepEqual(updateSpotlightSchema.parse({ location: "", cta_url: "" }), { location: null, cta_url: null });
});

// ======================= what members see =======================

test("a member card has no publishing details", () => {
    const card = toPublicSpotlight(row({ status: "PUBLISHED", publish_at: "2026-11-01T09:00" }));
    assert.deepEqual(Object.keys(card).sort(), ["category", "cta_label", "cta_url", "description", "ends_at", "id", "image_url", "is_online", "location", "starts_at", "title"]);
    assert.equal(card.is_online, false);
});

test("members get whatever the repository says is visible, capped", async () => {
    const find = mock.method(SpotlightRepository, "findVisible", async () => [row(), row({ id: 4 })]);
    const data = await SpotlightService.listVisible();
    assert.equal(data.spotlights.length, 2);
    assert.deepEqual(find.mock.calls[0].arguments, [6]);
    assert.doesNotMatch(JSON.stringify(data), /status|created_by|publish_at/);
});

test("SQL: visible means PUBLISHED, publish time reached, and not over", async () => {
    const calls = captureSql();
    await SpotlightRepository.findVisible(6);
    const { sql } = calls[0];
    assert.match(sql, /s\.status = 'PUBLISHED'/);
    assert.match(sql, /s\.publish_at IS NULL OR s\.publish_at <= NOW\(\)/);
    assert.match(sql, /COALESCE\(s\.ends_at, s\.starts_at\) >= NOW\(\)/);
    assert.match(sql, /LIMIT 6/);
});

// ======================= admin only =======================

test("every management action refuses anyone who is not an admin", async () => {
    const create = mock.method(SpotlightRepository, "create", async () => 1);
    const update = mock.method(SpotlightRepository, "update", async () => 1);
    const remove = mock.method(SpotlightRepository, "remove", async () => 1);
    const findAll = mock.method(SpotlightRepository, "findAll", async () => []);

    for (const viewer of [student, alumnus, undefined, { userId: 4 }]) {
        await assert.rejects(SpotlightService.listAll(viewer, { page: 1, limit: 20 }), { statusCode: 403 });
        await assert.rejects(SpotlightService.create(viewer, valid()), { statusCode: 403 });
        await assert.rejects(SpotlightService.update(viewer, 3, { title: "Changed title" }), { statusCode: 403 });
        await assert.rejects(SpotlightService.setStatus(viewer, 3, "PUBLISHED"), { statusCode: 403 });
        await assert.rejects(SpotlightService.remove(viewer, 3), { statusCode: 403 });
    }
    assert.equal(create.mock.callCount() + update.mock.callCount() + remove.mock.callCount() + findAll.mock.callCount(), 0);
});

test("admin create: the author is the signed-in admin", async () => {
    const create = mock.method(SpotlightRepository, "create", async () => 3);
    mock.method(SpotlightRepository, "findById", async () => row({ status: "DRAFT" }));
    const data = createSpotlightSchema.parse(valid());

    const created = await SpotlightService.create(admin, data);
    assert.deepEqual(create.mock.calls[0].arguments, [4, data]);
    assert.equal(created.status, "DRAFT");
    assert.equal(created.is_live, false);
});

test("admin list: every state, with counts and pagination", async () => {
    mock.method(SpotlightRepository, "findAll", async () => [row(), row({ id: 4, status: "PUBLISHED", is_scheduled: 1 }), row({ id: 5, is_over: 1 })]);
    mock.method(SpotlightRepository, "countAll", async () => 23);
    mock.method(SpotlightRepository, "countByStatus", async () => ({ PUBLISHED: 20, DRAFT: 3 }));

    const data = await SpotlightService.listAll(admin, { page: 2, limit: 10 });
    assert.deepEqual(data.spotlights.map((s) => s.is_live), [true, false, false]); // scheduled and finished ones are not live
    assert.deepEqual(data.counts, { DRAFT: 3, PUBLISHED: 20, ARCHIVED: 0 });
    assert.deepEqual(data.pagination, { page: 2, limit: 10, total: 23, totalPages: 3 });
    assert.equal(toAdminSpotlight(row({ status: "ARCHIVED" })).is_live, false);
});

test("admin update: missing is 404, bad id is 400, and merged dates / buttons must still make sense", async () => {
    const update = mock.method(SpotlightRepository, "update", async () => 1);
    mock.method(SpotlightRepository, "findById", async () => undefined);
    await assert.rejects(SpotlightService.update(admin, 99, { title: "Changed title" }), { statusCode: 404 });
    await assert.rejects(SpotlightService.update(admin, "abc", { title: "Changed title" }), { statusCode: 400 });

    mock.method(SpotlightRepository, "findById", async () => row({ starts_at: "2026-11-05T09:30", cta_label: "Go", cta_url: "https://example.com/x" }));
    await assert.rejects(SpotlightService.update(admin, 3, { ends_at: "2026-11-04T09:30" }), { statusCode: 400 });
    await assert.rejects(SpotlightService.update(admin, 3, { cta_url: null }), { statusCode: 400 });
    assert.equal(update.mock.callCount(), 0);

    await SpotlightService.update(admin, 3, { ends_at: "2026-11-06T17:00" });
    assert.deepEqual(update.mock.calls[0].arguments, [3, { ends_at: "2026-11-06T17:00" }]);
});

test("publish / unpublish / archive: only a real change is applied", async () => {
    const update = mock.method(SpotlightRepository, "update", async () => 1);
    mock.method(SpotlightRepository, "findById", async () => row({ status: "DRAFT" }));

    await assert.rejects(SpotlightService.setStatus(admin, 3, "DRAFT"), { statusCode: 400 });
    await SpotlightService.setStatus(admin, 3, "PUBLISHED");
    assert.deepEqual(update.mock.calls[0].arguments, [3, { status: "PUBLISHED" }]);
});

test("delete: gone for good, and a missing one is a 404", async () => {
    const remove = mock.method(SpotlightRepository, "remove", async () => 1);
    mock.method(SpotlightRepository, "findById", async () => row());
    assert.equal(await SpotlightService.remove(admin, "3"), true);
    assert.deepEqual(remove.mock.calls[0].arguments, [3]);

    mock.method(SpotlightRepository, "findById", async () => undefined);
    await assert.rejects(SpotlightService.remove(admin, 3), { statusCode: 404 });
});

test("SQL: only whitelisted columns are ever written, and dates are stored as given", async () => {
    const calls = captureSql([{ affectedRows: 1, insertId: 7 }]);
    await SpotlightRepository.update(3, { title: "T", starts_at: "2026-11-05T09:30", is_online: true, created_by: 99, id: 1, "status = 'PUBLISHED' --": 1 });
    assert.equal(calls[0].sql, "UPDATE campus_spotlights SET title = ?, starts_at = ?, is_online = ? WHERE id = ?");
    assert.deepEqual(calls[0].params, ["T", "2026-11-05 09:30:00", 1, 3]);

    calls.length = 0;
    assert.equal(await SpotlightRepository.update(3, { created_by: 99 }), 0);
    assert.equal(calls.length, 0);

    await SpotlightRepository.create(4, createSpotlightSchema.parse(valid({ starts_at: "2026-11-05T09:30" })));
    assert.match(calls[0].sql, /INSERT INTO campus_spotlights \(.*created_by\)/);
    assert.equal(calls[0].params[calls[0].params.length - 1], 4);
    assert.equal(calls[0].params[4], "2026-11-05 09:30:00");
});

// ======================= people you may know =======================

test("suggestions: public fields, mutual count and reason; always for the session user", async () => {
    const find = mock.method(ConnectionRepository, "findSuggestions", async () => [
        { user_id: 9, role: "ALUMNI", full_name: "Arjun Verma", profile_photo: null, company: "Acme", designation: "Engineer", branch: "CA", batch_year: 2024, mutual_connections: "3", same_branch: 1, email: "a@x.com", enrollment: "1" },
    ]);
    const data = await ConnectionService.getSuggestions(5);
    assert.deepEqual(find.mock.calls[0].arguments, [5, 8]);
    assert.deepEqual(data.people[0], {
        user_id: 9, full_name: "Arjun Verma", profile_photo: null, role: "ALUMNI", company: "Acme", designation: "Engineer", branch: "CA", batch_year: 2024,
        is_verified_alumni: true, relation: "none", connection_id: null, mutual_connections: 3, same_branch: true,
    });
    assert.doesNotMatch(JSON.stringify(data), /email|enrollment/);
});

test("SQL: suggestions are ACTIVE non-admins the viewer has no live connection with", async () => {
    const calls = captureSql();
    await ConnectionRepository.findSuggestions(5, 8);
    const { sql, params } = calls[0];
    assert.match(sql, /u\.status = 'ACTIVE'/);
    assert.match(sql, /u\.role <> 'ADMIN'/);
    assert.match(sql, /u\.id <> \?/);
    assert.match(sql, /NOT EXISTS \( SELECT 1 FROM connections c WHERE c\.status IN \('PENDING', 'ACCEPTED'\)/);
    assert.match(sql, /ORDER BY mutual_connections DESC/);
    assert.match(sql, /LIMIT 8/);
    assert.doesNotMatch(sql, /email|enrollment|password/);
    assert.equal(params.every((p) => p === 5), true);
});

// ======================= HTTP =======================

let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/spotlights", spotlightRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/spotlights`;
});
after(() => server.close());

const bearer = (userId, role) => ({ Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`, "Content-Type": "application/json" });
const session = (userId, role, status = "ACTIVE") =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role, status }));

test("HTTP: signed-out users get nothing; members can read live cards but not manage", async () => {
    assert.equal((await fetch(base)).status, 401);

    session(5, "STUDENT");
    mock.method(SpotlightRepository, "findVisible", async () => [row()]);
    const create = mock.method(SpotlightRepository, "create", async () => 1);
    const remove = mock.method(SpotlightRepository, "remove", async () => 1);

    const list = await fetch(base, { headers: bearer(5, "STUDENT") });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).data.spotlights.length, 1);

    assert.equal((await fetch(`${base}/manage`, { headers: bearer(5, "STUDENT") })).status, 403);
    assert.equal((await fetch(base, { method: "POST", headers: bearer(5, "STUDENT"), body: JSON.stringify(valid()) })).status, 403);
    assert.equal((await fetch(`${base}/3`, { method: "PATCH", headers: bearer(5, "STUDENT"), body: JSON.stringify({ title: "Changed title" }) })).status, 403);
    assert.equal((await fetch(`${base}/3/status`, { method: "PATCH", headers: bearer(5, "STUDENT"), body: JSON.stringify({ status: "PUBLISHED" }) })).status, 403);
    assert.equal((await fetch(`${base}/3`, { method: "DELETE", headers: bearer(5, "STUDENT") })).status, 403);
    assert.equal(create.mock.callCount() + remove.mock.callCount(), 0);
});

test("HTTP: a token that claims ADMIN is not enough - the role comes from the session", async () => {
    session(5, "STUDENT"); // the database says STUDENT
    const create = mock.method(SpotlightRepository, "create", async () => 1);
    const res = await fetch(base, { method: "POST", headers: bearer(5, "ADMIN"), body: JSON.stringify(valid()) });
    assert.equal(res.status, 403);
    assert.equal(create.mock.callCount(), 0);
});

test("HTTP: an admin can create, and invalid input is a 400", async () => {
    session(4, "ADMIN");
    const create = mock.method(SpotlightRepository, "create", async () => 3);
    mock.method(SpotlightRepository, "findById", async () => row({ status: "DRAFT" }));

    const ok = await fetch(base, { method: "POST", headers: bearer(4, "ADMIN"), body: JSON.stringify(valid({ status: "PUBLISHED" })) });
    assert.equal(ok.status, 201);
    assert.equal(create.mock.calls[0].arguments[0], 4);

    const bad = await fetch(base, { method: "POST", headers: bearer(4, "ADMIN"), body: JSON.stringify(valid({ cta_label: "Go", cta_url: "http://insecure.example.com" })) });
    assert.equal(bad.status, 400);
    assert.equal(create.mock.callCount(), 1);
});
