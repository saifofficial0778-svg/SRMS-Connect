process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const Repo = require("../src/modules/intro/intro.repository");
const Service = require("../src/modules/intro/intro.service");
const V = require("../src/modules/intro/intro.validation");
const ConnectionRepository = require("../src/modules/connection/connection.repository");
const introRoutes = require("../src/modules/intro/intro.route");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const stubNotifications = require("./helpers/stubNotifications");

let notes;
beforeEach(() => {
    notes = stubNotifications(mock);
});
afterEach(() => mock.restoreAll());

// S (student 1) wants to reach T (alumnus 20). I (alumnus 10) knows both.
const STUDENT = { userId: 1, role: "STUDENT" };
const INTRODUCER = { userId: 10, role: "ALUMNI" };
const TARGET = { userId: 20, role: "ALUMNI" };
const OUTSIDER = { userId: 55, role: "STUDENT" };
const WHY = "I admire their work in data engineering and would love a short chat.";
const validIntro = { target_id: 20, introducer_id: 10, message: WHY };

const alumnus = (id, name) => ({ id, role: "ALUMNI", status: "ACTIVE", full_name: name, profile_photo: null, designation: "Engineer", company: "Acme" });

const introRow = (over = {}) => ({
    id: 7, requester_id: 1, target_id: 20, introducer_id: 10, message: WHY, introducer_note: null, status: "PENDING",
    responded_at: null, created_at: "t0", updated_at: "t0",
    requester_name: "Aarav Sharma", requester_photo: null, requester_designation: null, requester_company: null,
    requester_role: "STUDENT", requester_status: "ACTIVE", requester_branch: "Computer Applications", requester_batch_year: 2025,
    target_name: "Meera Iyer", target_photo: null, target_designation: "Data Engineer", target_company: "Globex",
    target_role: "ALUMNI", target_status: "ACTIVE",
    introducer_name: "Arjun Verma", introducer_photo: null, introducer_designation: "Engineer", introducer_company: "Acme",
    introducer_role: "ALUMNI", introducer_status: "ACTIVE",
    requester_email: "aarav@secret.test", target_mobile: "9999999999", ...over,
});

// Connections as a set of "a-b" pairs that are ACCEPTED. Default: S-I and I-T, but not S-T.
function stubWorld(opts = {}) {
    const pick = (key, fallback) => (key in opts ? opts[key] : fallback);
    const accepted = new Set(pick("accepted", ["1-10", "10-20"]));
    const users = pick("users", { 20: alumnus(20, "Meera Iyer"), 10: alumnus(10, "Arjun Verma") });
    return {
        user: mock.method(Repo, "findUserBrief", async (id) => users[id]),
        connection: mock.method(ConnectionRepository, "findConnection", async (a, b) => {
            const key = [Number(a), Number(b)].sort((x, y) => x - y).join("-");
            return accepted.has(key) ? { id: 1, status: "ACCEPTED" } : undefined;
        }),
        open: mock.method(Repo, "findOpenIntro", async () => pick("open", undefined)),
        pending: mock.method(Repo, "countPendingByRequester", async () => pick("pending", 0)),
        create: mock.method(Repo, "createIntro", async () => 7),
        mutual: mock.method(Repo, "findMutualAlumni", async () => pick("mutual", [{ user_id: 10, full_name: "Arjun Verma", profile_photo: null, designation: "Engineer", company: "Acme", email: "x@secret.test" }])),
    };
}

// ======================= validation =======================

test("intro request: the requester can't be named, and the three people must differ", () => {
    const ok = (over) => V.createIntroSchema.safeParse({ ...validIntro, ...over }).success;
    assert.equal(ok({}), true);
    assert.equal(ok({ introducer_id: 20 }), false); // can't ask someone to introduce you to themselves
    assert.equal(ok({ message: "pls intro" }), false);
    assert.equal(ok({ message: "x".repeat(601) }), false);
    assert.equal(ok({ target_id: "20" }), false);
    for (const forged of [{ requester_id: 9 }, { student_id: 9 }, { status: "INTRODUCED" }, { id: 3 }]) {
        assert.equal(ok(forged), false, JSON.stringify(forged));
    }
    assert.equal(V.respondIntroSchema.safeParse({ action: "INTRODUCE" }).success, true);
    assert.equal(V.respondIntroSchema.safeParse({ action: "CANCEL" }).success, false);
    assert.equal(V.respondIntroSchema.parse({ action: "DECLINE", note: "  " }).note, undefined);
    assert.equal(V.listIntrosSchema.parse({}).box, "sent");
    assert.equal(V.listIntrosSchema.safeParse({ box: "all" }).success, false);
    assert.equal(V.introPathsSchema.parse({ target_id: "20" }).target_id, 20);
    assert.equal(V.introPathsSchema.safeParse({ target_id: "20", user_id: "1" }).success, false);
});

// ======================= finding a path =======================

test("paths: lists mutual alumni who could introduce you, with public fields only", async () => {
    const w = stubWorld();

    const paths = await Service.getPaths(STUDENT, { target_id: 20 });

    assert.deepEqual(w.mutual.mock.calls[0].arguments, [1, 20]);
    assert.equal(paths.already_connected, false);
    assert.equal(paths.can_request, true);
    assert.equal(paths.existing, null);
    assert.deepEqual(paths.introducers, [{ user_id: 10, full_name: "Arjun Verma", profile_photo: null, designation: "Engineer", company: "Acme", is_verified_alumni: true }]);
    assert.equal(paths.target.full_name, "Meera Iyer");
    assert.equal(JSON.stringify(paths).includes("secret.test"), false);
});

test("paths: already connected, an open request, and who can ask are all reported", async () => {
    stubWorld({ accepted: ["1-10", "10-20", "1-20"], open: { id: 7, status: "PENDING", introducer_id: 10 } });
    const paths = await Service.getPaths(STUDENT, { target_id: 20 });
    assert.equal(paths.already_connected, true);
    assert.deepEqual(paths.existing, { id: 7, status: "PENDING" });

    assert.equal((await Service.getPaths(INTRODUCER, { target_id: 20 })).can_request, false); // alumni don't use this flow
});

test("paths: only ACTIVE alumni can be approached, and never yourself", async () => {
    for (const target of [undefined, { ...alumnus(20, "X"), status: "BLOCKED" }, { ...alumnus(20, "X"), role: "STUDENT" }]) {
        stubWorld({ users: { 20: target } });
        await assert.rejects(Service.getPaths(STUDENT, { target_id: 20 }), { statusCode: 404 });
        mock.restoreAll();
    }
    stubWorld();
    await assert.rejects(Service.getPaths({ userId: 20, role: "STUDENT" }, { target_id: 20 }), { statusCode: 400 });
});

// ======================= asking for an introduction =======================

test("a student asks a mutual alumnus; only the introducer is told", async () => {
    const w = stubWorld();

    assert.deepEqual(await Service.createIntro(STUDENT, validIntro), { id: 7 });

    assert.deepEqual(w.create.mock.calls[0].arguments[0], { requesterId: 1, targetId: 20, introducerId: 10, message: WHY });
    assert.equal(notes.notifyEvent.mock.callCount(), 1);
    const n = notes.notifyEvent.mock.calls[0].arguments[0];
    assert.deepEqual([n.type, n.recipientId, n.actorId, n.referenceId, n.dedupeKey], ["INTRO_REQUEST", 10, 1, 7, "INTRO:7:PENDING"]);
    assert.equal(n.extra, "PENDING|Meera Iyer");
    // nothing reaches the person being approached at this point
    assert.equal(notes.notifyEvent.mock.calls.some((c) => c.arguments[0].recipientId === 20), false);
});

test("only students can ask, and they can't be the target or the introducer", async () => {
    const w = stubWorld();
    await assert.rejects(Service.createIntro(INTRODUCER, validIntro), { statusCode: 403 });
    await assert.rejects(Service.createIntro({ userId: 2, role: "ADMIN" }, validIntro), { statusCode: 403 });
    await assert.rejects(Service.createIntro({ userId: 20, role: "STUDENT" }, validIntro), { statusCode: 400 });
    await assert.rejects(Service.createIntro({ userId: 10, role: "STUDENT" }, validIntro), { statusCode: 400 });
    assert.equal(w.create.mock.callCount(), 0);
});

test("target and introducer must both be ACTIVE alumni", async () => {
    const cases = [
        { 10: alumnus(10, "I") }, // target missing
        { 20: { ...alumnus(20, "T"), status: "BLOCKED" }, 10: alumnus(10, "I") },
        { 20: { ...alumnus(20, "T"), role: "STUDENT" }, 10: alumnus(10, "I") },
        { 20: alumnus(20, "T") }, // introducer missing
        { 20: alumnus(20, "T"), 10: { ...alumnus(10, "I"), status: "PENDING" } },
        { 20: alumnus(20, "T"), 10: { ...alumnus(10, "I"), role: "STUDENT" } },
    ];
    for (const users of cases) {
        const w = stubWorld({ users });
        await assert.rejects(Service.createIntro(STUDENT, validIntro), { statusCode: 404 });
        assert.equal(w.create.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
});

test("the introducer must have an ACCEPTED connection with BOTH people", async () => {
    for (const accepted of [[], ["1-10"], ["10-20"]]) {
        const w = stubWorld({ accepted });
        await assert.rejects(Service.createIntro(STUDENT, validIntro), { statusCode: 403 }, JSON.stringify(accepted));
        assert.equal(w.create.mock.callCount(), 0);
        assert.equal(notes.notifyEvent.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
});

test("no introduction is needed (or allowed) when you are already connected", async () => {
    const w = stubWorld({ accepted: ["1-10", "10-20", "1-20"] });
    await assert.rejects(Service.createIntro(STUDENT, validIntro), (e) => e.statusCode === 400 && /already connected/.test(e.message));
    assert.equal(w.create.mock.callCount(), 0);
});

test("duplicates: already introduced, a pending request (unique key), and too many outstanding", async () => {
    let w = stubWorld({ open: { id: 3, status: "INTRODUCED", introducer_id: 10 } });
    await assert.rejects(Service.createIntro(STUDENT, validIntro), (e) => e.statusCode === 409 && /already been introduced/.test(e.message));
    assert.equal(w.create.mock.callCount(), 0);

    mock.restoreAll();
    notes = stubNotifications(mock);
    w = stubWorld();
    w.create.mock.mockImplementation(async () => { throw Object.assign(new Error("Duplicate entry '1-20-1'"), { code: "ER_DUP_ENTRY" }); });
    await assert.rejects(Service.createIntro(STUDENT, validIntro), (e) => e.statusCode === 409 && !e.message.includes("Duplicate entry"));
    assert.equal(notes.notifyEvent.mock.callCount(), 0);

    mock.restoreAll();
    notes = stubNotifications(mock);
    w = stubWorld({ pending: 5 });
    await assert.rejects(Service.createIntro(STUDENT, validIntro), { statusCode: 400 });
    assert.equal(w.create.mock.callCount(), 0);
});

// ======================= responding =======================

function stubFlow(row, { accepted = ["1-10", "10-20"], changed = true } = {}) {
    const set = new Set(accepted);
    return {
        find: mock.method(Repo, "findIntroById", async () => row),
        connection: mock.method(ConnectionRepository, "findConnection", async (a, b) => {
            const key = [Number(a), Number(b)].sort((x, y) => x - y).join("-");
            return set.has(key) ? { status: "ACCEPTED" } : undefined;
        }),
        resolve: mock.method(Repo, "resolve", async () => changed),
    };
}

test("the introducer makes the introduction: only then is the target told, and nothing else happens", async () => {
    const w = stubFlow(introRow());

    assert.deepEqual(await Service.respond(INTRODUCER, 7, { action: "INTRODUCE", note: "Sharp student, worth a chat." }), { id: 7, status: "INTRODUCED" });

    assert.deepEqual(w.resolve.mock.calls[0].arguments[0], { id: 7, to: "INTRODUCED", note: "Sharp student, worth a chat." });
    assert.deepEqual(notes.settleByKey.mock.calls[0].arguments, ["INTRO:7:PENDING"]);
    const sent = notes.notifyEvent.mock.calls.map((c) => c.arguments[0]);
    assert.deepEqual(sent.map((n) => [n.recipientId, n.type, n.extra, n.dedupeKey, n.actorId]), [
        [1, "INTRO_UPDATE", "INTRODUCED|Meera Iyer", "INTRO:7:INTRODUCED", 10], // the student
        [20, "INTRO_UPDATE", "INTRODUCED_TO_YOU|Aarav Sharma", "INTRO:7:INTRODUCED", 10], // the person approached
    ]);
});

test("declining tells the student only - the target never hears about it", async () => {
    const w = stubFlow(introRow());

    assert.deepEqual(await Service.respond(INTRODUCER, 7, { action: "DECLINE", note: "I don't know them well enough." }), { id: 7, status: "DECLINED" });

    assert.equal(w.connection.mock.callCount(), 0); // declining needs no connection check
    const sent = notes.notifyEvent.mock.calls.map((c) => c.arguments[0]);
    assert.deepEqual(sent.map((n) => [n.recipientId, n.extra]), [[1, "DECLINED|Meera Iyer"]]);
});

test("introducing requires both people to still be ACTIVE and connected to the introducer", async () => {
    for (const [row, accepted] of [
        [introRow({ requester_status: "BLOCKED" }), ["1-10", "10-20"]],
        [introRow({ target_status: "BLOCKED" }), ["1-10", "10-20"]],
        [introRow(), ["1-10"]], // no longer connected to the target
        [introRow(), ["10-20"]], // no longer connected to the student
    ]) {
        const w = stubFlow(row, { accepted });
        await assert.rejects(Service.respond(INTRODUCER, 7, { action: "INTRODUCE" }), { statusCode: 409 });
        assert.equal(w.resolve.mock.callCount(), 0);
        assert.equal(notes.notifyEvent.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
});

test("only a PENDING request can be answered, and a lost race notifies nobody", async () => {
    for (const status of ["INTRODUCED", "DECLINED", "CANCELLED"]) {
        const w = stubFlow(introRow({ status }));
        await assert.rejects(Service.respond(INTRODUCER, 7, { action: "INTRODUCE" }), { statusCode: 409 }, status);
        assert.equal(w.resolve.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
    stubFlow(introRow(), { changed: false });
    await assert.rejects(Service.respond(INTRODUCER, 7, { action: "INTRODUCE" }), { statusCode: 409 });
    assert.equal(notes.notifyEvent.mock.callCount(), 0);
});

test("the student can cancel a pending request; it vanishes from the introducer's notifications", async () => {
    const w = stubFlow(introRow());
    assert.deepEqual(await Service.cancel(STUDENT, 7), { id: 7, status: "CANCELLED" });
    assert.deepEqual(w.resolve.mock.calls[0].arguments[0], { id: 7, to: "CANCELLED" });
    assert.deepEqual(notes.removeByKey.mock.calls[0].arguments, ["INTRO:7:PENDING"]);
    assert.equal(notes.notifyEvent.mock.callCount(), 0);

    mock.restoreAll();
    notes = stubNotifications(mock);
    stubFlow(introRow({ status: "INTRODUCED" }));
    await assert.rejects(Service.cancel(STUDENT, 7), { statusCode: 409 });
});

// ======================= who can see and do what =======================

test("the target cannot see or act on a request until the introduction is actually made", async () => {
    for (const status of ["PENDING", "DECLINED", "CANCELLED"]) {
        const w = stubFlow(introRow({ status }));
        await assert.rejects(Service.getIntro(TARGET, 7), { statusCode: 404 }, status);
        await assert.rejects(Service.respond(TARGET, 7, { action: "INTRODUCE" }), { statusCode: 404 }, status);
        await assert.rejects(Service.cancel(TARGET, 7), { statusCode: 404 }, status);
        assert.equal(w.resolve.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }

    stubFlow(introRow({ status: "INTRODUCED", introducer_note: "Worth a chat." }));
    const seen = await Service.getIntro(TARGET, 7);
    assert.equal(seen.my_role, "target");
    assert.equal(seen.introducer_note, "Worth a chat.");
    assert.deepEqual(seen.actions, []);
});

test("outsiders get a 404; the student can't introduce and the introducer can't cancel", async () => {
    const w = stubFlow(introRow());

    await assert.rejects(Service.getIntro(OUTSIDER, 7), { statusCode: 404 });
    await assert.rejects(Service.respond(OUTSIDER, 7, { action: "INTRODUCE" }), { statusCode: 404 });
    await assert.rejects(Service.respond({ userId: 77, role: "ALUMNI" }, 7, { action: "INTRODUCE" }), { statusCode: 404 });
    await assert.rejects(Service.cancel(OUTSIDER, 7), { statusCode: 404 });

    await assert.rejects(Service.respond(STUDENT, 7, { action: "INTRODUCE" }), { statusCode: 403 }); // can't introduce yourself
    await assert.rejects(Service.cancel(INTRODUCER, 7), { statusCode: 403 });

    assert.equal(w.resolve.mock.callCount(), 0);
    assert.equal(notes.notifyEvent.mock.callCount(), 0);
});

test("missing and malformed ids", async () => {
    mock.method(Repo, "findIntroById", async () => undefined);
    await assert.rejects(Service.getIntro(STUDENT, 999), { statusCode: 404 });
    for (const bad of ["abc", "0", "-1", "1.5"]) await assert.rejects(Service.getIntro(STUDENT, bad), { statusCode: 400 }, bad);
});

test("an introduction shows three people by public profile fields only, and the right actions", async () => {
    stubFlow(introRow());
    const asStudent = await Service.getIntro(STUDENT, 7);

    assert.deepEqual(Object.keys(asStudent).sort(), [
        "actions", "created_at", "id", "introducer", "introducer_note", "message", "my_role", "requester", "responded_at", "status", "target",
    ]);
    assert.deepEqual(Object.keys(asStudent.target).sort(), ["company", "designation", "full_name", "is_verified_alumni", "profile_photo", "user_id"]);
    assert.deepEqual(Object.keys(asStudent.requester).sort(), ["batch_year", "branch", "company", "designation", "full_name", "profile_photo", "user_id"]);
    assert.equal(asStudent.my_role, "requester");
    assert.deepEqual(asStudent.actions, ["CANCEL"]);
    for (const secret of ["secret.test", "9999999999"]) assert.equal(JSON.stringify(asStudent).includes(secret), false, secret);

    const asIntroducer = await Service.getIntro(INTRODUCER, 7);
    assert.equal(asIntroducer.my_role, "introducer");
    assert.deepEqual(asIntroducer.actions, ["INTRODUCE", "DECLINE"]);
});

// ======================= the SQL that actually runs =======================

test("lists are bound to the viewer; 'received' only ever contains introductions that were made", () => {
    assert.deepEqual(Repo.buildIntroFilter(1, "sent"), { whereSql: "wi.requester_id = ?", params: [1] });
    const toIntroduce = Repo.buildIntroFilter(10, "to_introduce");
    assert.match(toIntroduce.whereSql, /wi\.introducer_id = \?/);
    assert.deepEqual(toIntroduce.params, [10]);
    const received = Repo.buildIntroFilter(20, "received");
    assert.match(received.whereSql, /wi\.target_id = \? AND wi\.status = 'INTRODUCED'/);
    assert.deepEqual(received.params, [20]);
});

test("mutual alumni = ACTIVE alumni with an ACCEPTED connection to both people; no private columns", async () => {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => { calls.push({ sql: sql.replace(/\s+/g, " "), params }); return [[{ total: 0 }], []]; });

    await Repo.findMutualAlumni(1, 20);
    await Repo.findIntroById(7);
    await Repo.findIntros(1, "sent", 10, 0);
    await Repo.findUserBrief(20);

    const mutual = calls[0];
    assert.match(mutual.sql, /u\.status = 'ACTIVE' AND u\.role = 'ALUMNI'/);
    assert.equal((mutual.sql.match(/c\.status = 'ACCEPTED'/g) || []).length, 2); // one check per person
    assert.match(mutual.sql, /u\.id NOT IN \(\?, \?\)/);
    assert.deepEqual(mutual.params, [1, 20, 1, 1, 20, 20]);
    for (const { sql } of calls) {
        for (const col of ["email", "enrollment", "mobile", "dob", "password"]) assert.equal(sql.includes(col), false, `${col}: ${sql.slice(0, 50)}`);
    }
});

test("resolving is compare-and-set on PENDING", async () => {
    const seen = [];
    mock.method(pool, "getConnection", async () => ({
        beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
        execute: async (sql, params) => { seen.push({ sql: sql.replace(/\s+/g, " ").trim(), params }); return [{ affectedRows: 0 }]; },
    }));

    assert.equal(await Repo.resolve({ id: 7, to: "INTRODUCED", note: "hello" }), false); // somebody else got there first
    assert.equal(seen[0].sql, "UPDATE warm_intros SET status = ?, responded_at = CURRENT_TIMESTAMP, introducer_note = ? WHERE id = ? AND status = 'PENDING'");
    assert.deepEqual(seen[0].params, ["INTRODUCED", "hello", 7]);
});

// ======================= HTTP API =======================

let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/intros", introRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/intros`;
});
after(() => server.close());

const headers = (userId, role) => ({
    Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
    "Content-Type": "application/json",
});
const session = (userId, role, status = "ACTIVE") =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role, status }));
const send = (method, path, who, body) =>
    fetch(`${base}${path}`, { method, headers: headers(who.userId, who.role), body: body === undefined ? undefined : JSON.stringify(body) });

test("HTTP: every introduction endpoint requires a signed-in, ACTIVE user", async () => {
    for (const [method, path] of [["GET", "/paths?target_id=20"], ["GET", ""], ["POST", ""], ["GET", "/7"], ["PATCH", "/7/respond"], ["PATCH", "/7/cancel"]]) {
        assert.equal((await fetch(`${base}${path}`, { method })).status, 401, `${method} ${path}`);
    }
    session(1, "STUDENT", "BLOCKED");
    assert.equal((await send("GET", "", STUDENT)).status, 401);
});

test("HTTP: a student asks as themselves (201); role comes from the session; the requester can't be forged", async () => {
    const w = stubWorld();

    session(1, "STUDENT");
    const res = await send("POST", "", STUDENT, validIntro);
    assert.equal(res.status, 201);
    assert.deepEqual((await res.json()).data, { id: 7 });
    assert.equal(w.create.mock.calls[0].arguments[0].requesterId, 1);
    assert.equal((await send("POST", "", STUDENT, { ...validIntro, requester_id: 55 })).status, 400);

    // really an alumnus, whatever the token says
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 10, role: "ALUMNI", status: "ACTIVE" }));
    assert.equal((await send("POST", "", { userId: 10, role: "STUDENT" }, { target_id: 20, introducer_id: 30, message: WHY })).status, 403);
    assert.equal(w.create.mock.callCount(), 1);
});

test("HTTP: paths route is not mistaken for an id; lists validate their box", async () => {
    session(1, "STUDENT");
    stubWorld();
    mock.method(Repo, "findIntros", async () => [introRow()]);
    mock.method(Repo, "countIntros", async () => 1);

    const paths = await send("GET", "/paths?target_id=20", STUDENT);
    assert.equal(paths.status, 200);
    assert.equal((await paths.json()).data.introducers.length, 1);
    assert.equal((await send("GET", "/paths", STUDENT)).status, 400);

    const list = await send("GET", "?box=sent", STUDENT);
    const body = await list.json();
    assert.equal(list.status, 200);
    assert.equal(body.data.intros[0].my_role, "requester");
    assert.equal(JSON.stringify(body).includes("secret.test"), false);
    assert.equal((await send("GET", "?box=everything", STUDENT)).status, 400);
});

test("HTTP: respond and cancel enforce who is acting", async () => {
    stubFlow(introRow());

    session(20, "ALUMNI"); // the person being approached can't even see a pending request
    assert.equal((await send("GET", "/7", TARGET)).status, 404);
    assert.equal((await send("PATCH", "/7/respond", TARGET, { action: "INTRODUCE" })).status, 404);

    session(1, "STUDENT"); // the student can't make their own introduction
    assert.equal((await send("PATCH", "/7/respond", STUDENT, { action: "INTRODUCE" })).status, 403);

    session(10, "ALUMNI"); // the introducer can't cancel it, but can introduce
    assert.equal((await send("PATCH", "/7/cancel", INTRODUCER)).status, 403);
    const ok = await send("PATCH", "/7/respond", INTRODUCER, { action: "INTRODUCE", note: "Worth a chat" });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).data, { id: 7, status: "INTRODUCED" });
    assert.equal((await send("PATCH", "/7/respond", INTRODUCER, { action: "APPROVE" })).status, 400);
    assert.equal((await send("PATCH", "/abc/respond", INTRODUCER, { action: "DECLINE" })).status, 400);
});
