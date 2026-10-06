process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { io: connectClient } = require("socket.io-client");

const authRepository = require("../src/modules/auth/auth.repository");
const AuthService = require("../src/modules/auth/auth.service");
const verifyToken = require("../src/middlewares/authMiddleware");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const setupSocket = require("../src/socket/socket");
const ConversationRepository = require("../src/modules/chat/chat.repository");
const ConnectionRepository = require("../src/modules/connection/connection.repository");

// ---- in-memory stand-in for the user_sessions + users tables ----
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
let sessions; // tokenHash -> { userId, role, status, revoked, expired }
let connectionStatus;
let createMessage;

const login = (userId, overrides = {}) => {
    const token = jwt.sign({ userId, role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    sessions.set(hash(token), { userId, role: "STUDENT", status: "ACTIVE", revoked: false, expired: false, ...overrides });
    return token;
};
const sessionOf = (token) => sessions.get(hash(token));

let httpServer, base;
let socketServer, socketBase;
const openClients = [];

before(async () => {
    // HTTP app using the real auth middleware + real logout service call
    const app = express();
    app.get("/protected", verifyToken, (req, res) => res.json({ userId: req.user.userId }));
    app.post("/logout", verifyToken, (req, res, next) =>
        AuthService.logout(req.user.userId, req.user.token).then(() => res.json({ ok: true }), next)
    );
    app.use(globalErrorHandler);
    httpServer = http.createServer(app);
    await new Promise((r) => httpServer.listen(0, r));
    base = `http://127.0.0.1:${httpServer.address().port}`;

    // real Socket.IO server using the real setupSocket
    socketServer = http.createServer();
    setupSocket(new Server(socketServer));
    await new Promise((r) => socketServer.listen(0, r));
    socketBase = `http://127.0.0.1:${socketServer.address().port}`;
});

after(() => {
    openClients.forEach((c) => c.disconnect());
    httpServer.close();
    socketServer.closeAllConnections?.();
    socketServer.close();
});

beforeEach(() => {
    require("./helpers/stubNotifications")(mock);
    sessions = new Map();
    connectionStatus = "ACCEPTED";

    mock.method(authRepository, "findActiveSession", async (userId, tokenHash) => {
        const s = sessions.get(tokenHash);
        if (!s || s.userId !== userId || s.revoked || s.expired) return undefined;
        return { id: 1, user_id: s.userId, role: s.role, status: s.status };
    });
    mock.method(authRepository, "revokeSession", async (userId, tokenHash) => {
        const s = sessions.get(tokenHash);
        if (!s) return 0;
        s.revoked = true;
        return 1;
    });

    mock.method(ConversationRepository, "findConversationById", async () => ({ id: 10, user_one_id: 1, user_two_id: 2 }));
    mock.method(ConnectionRepository, "findConnection", async () => ({ id: 1, status: connectionStatus }));
    createMessage = mock.method(ConversationRepository, "createMessage", async () => 500);
});

afterEach(() => mock.restoreAll());

const get = (token) => fetch(`${base}/protected`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

// ================= HTTP =================

test("HTTP: a live session of an ACTIVE user is accepted", async () => {
    const res = await get(login(1));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { userId: 1 });
});

test("HTTP: after logout the same token is rejected", async () => {
    const token = login(1);
    assert.equal((await get(token)).status, 200);

    const out = await fetch(`${base}/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    assert.equal(out.status, 200);

    assert.equal((await get(token)).status, 401);
});

test("HTTP: a user blocked after login is rejected on the very next request", async () => {
    const token = login(1);
    assert.equal((await get(token)).status, 200);

    sessionOf(token).status = "BLOCKED";

    assert.equal((await get(token)).status, 401);
});

test("HTTP: an expired session row is rejected even though the JWT itself is still valid", async () => {
    const token = login(1, { expired: true });
    assert.equal((await get(token)).status, 401);
});

test("HTTP: an expired JWT, a forged JWT and a missing token are all rejected", async () => {
    const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: -5 });
    sessions.set(hash(expired), { userId: 1, role: "STUDENT", status: "ACTIVE", revoked: false, expired: false });
    assert.equal((await get(expired)).status, 401);

    const forged = jwt.sign({ userId: 1 }, "wrong-secret");
    assert.equal((await get(forged)).status, 401);

    assert.equal((await get(null)).status, 401);
});

// ================= Socket.IO =================

const connect = (token) =>
    new Promise((resolve, reject) => {
        const client = connectClient(socketBase, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
        openClients.push(client);
        client.once("connect", () => resolve(client));
        client.once("connect_error", (err) => reject(err));
    });

const once = (client, event, ms = 2000) =>
    new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
        client.once(event, (data) => { clearTimeout(t); resolve(data); });
    });

test("Socket: handshake is refused without a token, with a revoked session, and for a blocked user", async () => {
    await assert.rejects(connect(null), /Authentication token required/);

    const revoked = login(1, { revoked: true });
    await assert.rejects(connect(revoked), /Invalid token/);

    const blocked = login(1, { status: "BLOCKED" });
    await assert.rejects(connect(blocked), /Invalid token/);
});

test("Socket: a live session with an ACCEPTED connection can send a message", async () => {
    const client = await connect(login(1));
    const sent = once(client, "message_sent");
    client.emit("send_message", { conversationId: 10, content: "hello" });

    assert.equal((await sent).content, "hello");
    assert.equal(createMessage.mock.callCount(), 1);
    client.disconnect();
});

test("Socket: once the connection is no longer ACCEPTED, messages are refused and not stored", async () => {
    const client = await connect(login(1));

    for (const status of ["REMOVED", "REJECTED", "CANCELLED", "PENDING"]) {
        connectionStatus = status;
        const failed = once(client, "message_error");
        client.emit("send_message", { conversationId: 10, content: "should not go" });
        assert.match((await failed).message, /chat only with connections/);
    }
    assert.equal(createMessage.mock.callCount(), 0);
    client.disconnect();
});

test("Socket: logging out while connected stops further sends and drops the socket", async () => {
    const token = login(1);
    const client = await connect(token);

    await AuthService.logout(1, token); // session revoked, socket still open

    const authError = once(client, "auth_error");
    const closed = once(client, "disconnect");
    client.emit("send_message", { conversationId: 10, content: "after logout" });

    assert.match((await authError).message, /Session expired/);
    await closed;
    assert.equal(createMessage.mock.callCount(), 0);
});

test("Socket: being blocked while connected stops further sends and drops the socket", async () => {
    const token = login(1);
    const client = await connect(token);

    sessionOf(token).status = "BLOCKED";

    const authError = once(client, "auth_error");
    const closed = once(client, "disconnect");
    client.emit("send_message", { conversationId: 10, content: "while blocked" });

    await authError;
    await closed;
    assert.equal(createMessage.mock.callCount(), 0);
});

test("Socket: an expired session stops mark_read as well", async () => {
    const token = login(1);
    const client = await connect(token);

    sessionOf(token).expired = true;

    const authError = once(client, "auth_error");
    client.emit("mark_read", { conversationId: 10, otherUserId: 2 });
    await authError;
    client.disconnect();
});
