const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { getClientOrigins } = require("../src/config/env");
const ConnectionRepository = require("../src/modules/connection/connection.repository");
const userRepository = require("../src/modules/userManagement/userManagement.repository");
const ConnectionService = require("../src/modules/connection/connection.service");

const stubNotifications = require("./helpers/stubNotifications");

beforeEach(() => stubNotifications(mock));
afterEach(() => mock.restoreAll());

// ---------- CORS / socket origin config ----------

test("getClientOrigins parses a comma-separated list and trims trailing slashes", () => {
    assert.deepEqual(
        getClientOrigins({ CLIENT_ORIGIN: "https://a.example.com/, https://b.example.com " }),
        ["https://a.example.com", "https://b.example.com"]
    );
});

test("getClientOrigins falls back to localhost only outside production", () => {
    assert.deepEqual(getClientOrigins({}), ["http://localhost:5173"]);
    assert.throws(() => getClientOrigins({ NODE_ENV: "production" }), /CLIENT_ORIGIN/);
});

// ---------- connection requests after a dead connection ----------

const stubUser = () => mock.method(userRepository, "findUserById", async () => ({ id: 9, status: "ACTIVE" }));

for (const status of ["REJECTED", "CANCELLED", "REMOVED"]) {
    test(`a new request is allowed after a ${status} connection`, async () => {
        stubUser();
        mock.method(ConnectionRepository, "findConnection", async () => ({ id: 1, status }));
        const create = mock.method(ConnectionRepository, "createConnection", async () => 55);

        assert.equal(await ConnectionService.sendRequest(4, 9), 55);
        assert.equal(create.mock.callCount(), 1);
    });
}

for (const status of ["PENDING", "ACCEPTED"]) {
    test(`a new request is blocked while a ${status} connection exists`, async () => {
        stubUser();
        mock.method(ConnectionRepository, "findConnection", async () => ({ id: 1, status }));
        const create = mock.method(ConnectionRepository, "createConnection", async () => 55);

        await assert.rejects(ConnectionService.sendRequest(4, 9), { statusCode: 409 });
        assert.equal(create.mock.callCount(), 0);
    });
}

test("a racing duplicate insert (unique index) becomes a 409, not a 500", async () => {
    stubUser();
    mock.method(ConnectionRepository, "findConnection", async () => undefined);
    mock.method(ConnectionRepository, "createConnection", async () => {
        throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
    });

    await assert.rejects(ConnectionService.sendRequest(4, 9), { statusCode: 409 });
});

// ---------- the people a member is connected with (suggestions under their profile) ----------

const pool = require("../src/config/db");
const { toSuggestion } = ConnectionService;

const suggestionRow = (over = {}) => ({
    user_id: 9, role: "ALUMNI", full_name: "Arjun Verma", profile_photo: null, company: "Acme", designation: "Engineer",
    branch: "CA", batch_year: 2024, viewer_connection_id: null, viewer_status: null, viewer_sender_id: null,
    email: "arjun@x.com", enrollment: "2024107401", password_hash: "x", ...over,
});

test("a suggestion carries public fields and the viewer's own relation, nothing private", () => {
    assert.deepEqual(toSuggestion(suggestionRow(), 5), {
        user_id: 9, full_name: "Arjun Verma", profile_photo: null, role: "ALUMNI", company: "Acme", designation: "Engineer",
        branch: "CA", batch_year: 2024, is_verified_alumni: true, relation: "none", connection_id: null,
    });
    assert.equal(toSuggestion(suggestionRow({ viewer_connection_id: 7, viewer_status: "ACCEPTED", viewer_sender_id: 9 }), 5).relation, "connected");
    assert.deepEqual(
        [toSuggestion(suggestionRow({ viewer_connection_id: 7, viewer_status: "PENDING", viewer_sender_id: 5 }), 5).relation,
         toSuggestion(suggestionRow({ viewer_connection_id: 7, viewer_status: "PENDING", viewer_sender_id: 9 }), 5).relation],
        ["sent", "received"]
    );
    assert.equal(toSuggestion(suggestionRow({ viewer_connection_id: 7, viewer_status: "PENDING", viewer_sender_id: 5 }), 5).connection_id, 7);
    assert.equal(toSuggestion(suggestionRow({ role: "STUDENT", full_name: null }), 5).full_name, "SRMS Member");
});

test("profile connections: only for an ACTIVE member, and always from the viewer's point of view", async () => {
    const find = mock.method(ConnectionRepository, "findConnectionsOfUser", async () => [suggestionRow()]);

    mock.method(userRepository, "findUserById", async () => ({ id: 9, role: "ALUMNI", status: "ACTIVE" }));
    const result = await ConnectionService.getProfileConnections(5, "9");
    assert.equal(result.people.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /email|enrollment|password/);
    assert.deepEqual(find.mock.calls[0].arguments, [9, 5, 12]);

    mock.method(userRepository, "findUserById", async () => ({ id: 9, role: "ALUMNI", status: "BLOCKED" }));
    await assert.rejects(ConnectionService.getProfileConnections(5, 9), { statusCode: 404 });
    mock.method(userRepository, "findUserById", async () => undefined);
    await assert.rejects(ConnectionService.getProfileConnections(5, 9), { statusCode: 404 });
    await assert.rejects(ConnectionService.getProfileConnections(5, "abc"), { statusCode: 400 });
    assert.equal(find.mock.callCount(), 1);
});

test("SQL: profile connections are ACCEPTED links to ACTIVE non-admin members, without the viewer", async () => {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql: String(sql).replace(/\s+/g, " "), params });
        return [[]];
    });
    await ConnectionRepository.findConnectionsOfUser(9, 5, 12);

    const { sql, params } = calls[0];
    assert.match(sql, /c\.status = 'ACCEPTED'/); // pending or rejected requests are nobody's business
    assert.match(sql, /u\.status = 'ACTIVE'/);
    assert.match(sql, /u\.role <> 'ADMIN'/);
    assert.match(sql, /u\.id <> \?/);
    assert.match(sql, /LIMIT 12/);
    assert.doesNotMatch(sql, /email|enrollment|password/);
    assert.deepEqual(params, [9, 5, 5, 9, 9, 5]);
});
