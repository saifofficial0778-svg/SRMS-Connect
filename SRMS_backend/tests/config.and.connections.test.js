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
