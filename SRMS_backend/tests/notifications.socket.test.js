process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { io: connectClient } = require("socket.io-client");

const authRepository = require("../src/modules/auth/auth.repository");
const NotificationRepository = require("../src/modules/notification/notification.repository");
const NotificationService = require("../src/modules/notification/notification.service");
const ConversationRepository = require("../src/modules/chat/chat.repository");
const ConnectionRepository = require("../src/modules/connection/connection.repository");
const setupSocket = require("../src/socket/socket");

let server, base;
const clients = [];

before(async () => {
    server = http.createServer();
    setupSocket(new Server(server)); // also registers the io instance NotificationService pushes through
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    clients.forEach((c) => c.disconnect());
    server.closeAllConnections?.();
    server.close();
});

beforeEach(() => {
    // any token is a live ACTIVE session of the user id inside it
    mock.method(authRepository, "findActiveSession", async (userId) => ({ id: 1, user_id: userId, role: "STUDENT", status: "ACTIVE" }));
});
afterEach(() => mock.restoreAll());

const token = (userId) => jwt.sign({ userId, role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" });

const connect = (userId) =>
    new Promise((resolve, reject) => {
        const client = connectClient(base, { auth: { token: token(userId) }, transports: ["websocket"], reconnection: false });
        clients.push(client);
        client.once("connect", () => resolve(client));
        client.once("connect_error", reject);
    });

// resolves with the first payload of `event`, rejects if nothing arrives
const waitFor = (client, event, ms = 1500) =>
    new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
        client.once(event, (payload) => { clearTimeout(t); resolve(payload); });
    });

// true when nothing arrives within `ms`
const staysSilent = (client, event, ms = 250) =>
    new Promise((resolve) => {
        let got = false;
        const handler = () => { got = true; };
        client.on(event, handler);
        setTimeout(() => { client.off(event, handler); resolve(!got); }, ms);
    });

const row = (over = {}) => ({
    id: 900, type: "POST_LIKE", reference_id: 50, extra: null, is_read: 0,
    created_at: "2026-01-01T00:00:00.000Z", actor_id: 4, actor_name: "Asha Rao", actor_photo: null, ...over,
});

function stubStore() {
    mock.method(NotificationRepository, "insertIfNew", async () => 900);
    mock.method(NotificationRepository, "findVisibleById", async () => row());
    mock.method(NotificationRepository, "countByRecipient", async () => 1);
}

test("a new notification reaches the recipient in real time, on every open tab, and nobody else", async () => {
    stubStore();
    const tabA = await connect(71);
    const tabB = await connect(71); // same user, second tab
    const stranger = await connect(72);

    const gotA = waitFor(tabA, "notification");
    const gotB = waitFor(tabB, "notification");
    const strangerSilent = staysSilent(stranger, "notification");

    await NotificationService.notifyPostLike({ postOwnerId: 71, actorId: 4, postId: 50 });

    for (const payload of [await gotA, await gotB]) {
        assert.equal(payload.unreadCount, 1);
        assert.equal(payload.notification.id, 900);
        assert.equal(payload.notification.type, "POST_LIKE");
        assert.deepEqual(payload.notification.actor, { user_id: 4, full_name: "Asha Rao", profile_photo: null });
    }
    assert.equal(await strangerSilent, true, "another user must not receive it");
});

test("a duplicate action pushes nothing", async () => {
    mock.method(NotificationRepository, "insertIfNew", async () => null); // dedupe hit
    const find = mock.method(NotificationRepository, "findVisibleById", async () => row());
    const client = await connect(73);
    const silent = staysSilent(client, "notification");

    await NotificationService.notifyPostLike({ postOwnerId: 73, actorId: 4, postId: 50 });

    assert.equal(await silent, true);
    assert.equal(find.mock.callCount(), 0);
});

test("read state is synced to all of the user's tabs (mark all read, mark one read)", async () => {
    mock.method(NotificationRepository, "markAllRead", async () => 2);
    mock.method(NotificationRepository, "existsForRecipient", async () => true);
    mock.method(NotificationRepository, "markRead", async () => 1);
    mock.method(NotificationRepository, "countByRecipient", async () => 4);
    const tabA = await connect(74);
    const tabB = await connect(74);

    const aAll = waitFor(tabA, "notifications_read");
    const bAll = waitFor(tabB, "notifications_read");
    await NotificationService.markAllRead(74);
    assert.deepEqual(await aAll, { all: true, unreadCount: 0 });
    assert.deepEqual(await bAll, { all: true, unreadCount: 0 });

    const aOne = waitFor(tabA, "notifications_read");
    const bOne = waitFor(tabB, "notifications_read");
    await NotificationService.markRead(74, 12);
    assert.deepEqual(await aOne, { ids: [12], unreadCount: 4 });
    assert.deepEqual(await bOne, { ids: [12], unreadCount: 4 });
});

test("a socket can't join another user's notification room", async () => {
    stubStore();
    const attacker = await connect(75);
    const victim = await connect(76);
    const silent = staysSilent(attacker, "notification");
    const received = waitFor(victim, "notification");

    attacker.emit("join", "user:76"); // nothing on the server honours this
    await new Promise((r) => setTimeout(r, 50));
    await NotificationService.notifyPostLike({ postOwnerId: 76, actorId: 4, postId: 50 });

    await received;
    assert.equal(await silent, true);
});

test("a user stays online until their last tab closes", async () => {
    const watcher = await connect(77);
    const offline = [];
    watcher.on("user_offline", (p) => offline.push(p.userId));

    const tabA = await connect(78);
    const tabB = await connect(78);

    tabA.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(offline, [], "still online through the other tab");

    const list = waitFor(watcher, "online_users");
    watcher.emit("get_online_users");
    assert.ok((await list).includes(78));

    tabB.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(offline, [78]);
});

test("a late-mounting page can ask for who is online", async () => {
    const a = await connect(79);
    const b = await connect(80);
    await new Promise((r) => setTimeout(r, 50));
    const list = waitFor(b, "online_users");
    b.emit("get_online_users");
    const ids = await list;
    assert.ok(ids.includes(79) && ids.includes(80));
    a.disconnect();
});

test("a chat message is delivered to every tab of the receiver", async () => {
    mock.method(ConversationRepository, "findConversationById", async () => ({ id: 10, user_one_id: 81, user_two_id: 82 }));
    mock.method(ConnectionRepository, "findConnection", async () => ({ id: 1, status: "ACCEPTED" }));
    mock.method(ConversationRepository, "createMessage", async () => 500);
    stubStore();

    const sender = await connect(81);
    const tabA = await connect(82);
    const tabB = await connect(82);
    const gotA = waitFor(tabA, "new_message");
    const gotB = waitFor(tabB, "new_message");
    const notified = waitFor(tabA, "notification");

    sender.emit("send_message", { conversationId: 10, content: "hello" });

    assert.equal((await gotA).content, "hello");
    assert.equal((await gotB).content, "hello");
    assert.equal((await notified).notification.id, 900); // and the notification arrives alongside
});
