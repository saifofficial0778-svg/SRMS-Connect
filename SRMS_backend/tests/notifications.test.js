process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const NotificationRepository = require("../src/modules/notification/notification.repository");
const NotificationService = require("../src/modules/notification/notification.service");
const registry = require("../src/socket/socketRegistry");
const notificationRoutes = require("../src/modules/notification/notification.route");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");

const ConnectionRepository = require("../src/modules/connection/connection.repository");
const ConnectionService = require("../src/modules/connection/connection.service");
const userRepository = require("../src/modules/userManagement/userManagement.repository");
const UserService = require("../src/modules/userManagement/userManagement.service");
const PostRepository = require("../src/modules/post/post.repository");
const PostService = require("../src/modules/post/post.service");
const ConversationRepository = require("../src/modules/chat/chat.repository");
const ConversationService = require("../src/modules/chat/chat.service");
const stubNotifications = require("./helpers/stubNotifications");

// fake Socket.IO server: records what would be pushed to which user room
let emitted;
const fakeIo = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };

beforeEach(() => {
    emitted = [];
    registry.setIo(fakeIo);
});
afterEach(() => mock.restoreAll());
after(() => registry.setIo(null));

// a row as the repository returns it (with the actor's public profile joined in)
const row = (over = {}) => ({
    id: 1,
    type: "POST_LIKE",
    reference_id: 50,
    extra: null,
    is_read: 0,
    created_at: "2026-01-01T10:00:00.000Z",
    actor_id: 4,
    actor_name: "Asha Rao",
    actor_photo: "a.jpg",
    ...over,
});

// ======================= creation =======================

function stubCreate({ inserted = 101, bumped = null, visible = row(), unread = 3 } = {}) {
    return {
        insert: mock.method(NotificationRepository, "insertIfNew", async () => inserted),
        bump: mock.method(NotificationRepository, "bumpByDedupeKey", async () => bumped),
        find: mock.method(NotificationRepository, "findVisibleById", async () => visible),
        count: mock.method(NotificationRepository, "countByRecipient", async () => unread),
    };
}

test("a connection request creates a notification for the receiver and pushes it over the socket", async () => {
    const s = stubCreate({ visible: row({ id: 101, type: "CONNECTION_REQUEST", reference_id: 9 }) });

    await NotificationService.notifyConnectionRequest({ senderId: 4, receiverId: 7, connectionId: 9 });

    assert.deepEqual(s.insert.mock.calls[0].arguments[0], {
        recipientId: 7, actorId: 4, type: "CONNECTION_REQUEST", referenceId: 9, extra: undefined, dedupeKey: "CONNECTION_REQUEST:9",
    });
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].room, "user:7");
    assert.equal(emitted[0].event, "notification");
    assert.equal(emitted[0].payload.unreadCount, 3);
    assert.equal(emitted[0].payload.notification.type, "CONNECTION_REQUEST");
});

test("each action maps to the right recipient, type, reference and dedupe key", async () => {
    const s = stubCreate();

    await NotificationService.notifyConnectionAccepted({ accepterId: 7, senderId: 4, connectionId: 9 });
    await NotificationService.notifyPostLike({ postOwnerId: 7, actorId: 4, postId: 50 });
    await NotificationService.notifyPostComment({ postOwnerId: 7, actorId: 4, postId: 50, commentId: 88, content: "  nice\n  one " });
    await NotificationService.notifyNewMessage({ receiverId: 7, senderId: 4, conversationId: 12, content: "hello" });
    await NotificationService.notifyAccountActivated({ userId: 7, previousStatus: "PENDING" });

    const calls = s.insert.mock.calls.map((c) => c.arguments[0]);
    assert.deepEqual(calls.map((c) => [c.recipientId, c.actorId, c.type, c.referenceId, c.dedupeKey]), [
        [4, 7, "CONNECTION_ACCEPTED", 9, "CONNECTION_ACCEPTED:9"], // goes to whoever sent the request
        [7, 4, "POST_LIKE", 50, "POST_LIKE:50:4"],
        [7, 4, "POST_COMMENT", 50, "POST_COMMENT:88"],
        [7, 4, "NEW_MESSAGE", 12, "NEW_MESSAGE:12"],
        [7, null, "ACCOUNT_STATUS", undefined, calls[4].dedupeKey],
    ]);
    assert.equal(calls[2].extra, "nice one"); // whitespace collapsed
    assert.equal(calls[4].extra, "APPROVED");
    assert.match(calls[4].dedupeKey, /^ACCOUNT_STATUS:\d+$/);
});

test("a reinstated (previously blocked) account gets REINSTATED, and the admin is not exposed", async () => {
    const s = stubCreate();
    await NotificationService.notifyAccountActivated({ userId: 7, previousStatus: "BLOCKED" });
    const call = s.insert.mock.calls[0].arguments[0];
    assert.equal(call.extra, "REINSTATED");
    assert.equal(call.actorId, null);
});

test("long snippets are truncated", async () => {
    const s = stubCreate();
    await NotificationService.notifyPostComment({ postOwnerId: 7, actorId: 4, postId: 1, commentId: 1, content: "x".repeat(500) });
    const extra = s.insert.mock.calls[0].arguments[0].extra;
    assert.equal(extra.length, 100);
    assert.ok(extra.endsWith("…"));
});

test("people are never notified about their own actions", async () => {
    const s = stubCreate();

    await NotificationService.notifyPostLike({ postOwnerId: 4, actorId: 4, postId: 50 });
    await NotificationService.notifyPostComment({ postOwnerId: 4, actorId: 4, postId: 50, commentId: 1, content: "me" });

    assert.equal(s.insert.mock.callCount(), 0);
    assert.equal(emitted.length, 0);
});

test("a duplicate action (same dedupe key) creates and pushes nothing", async () => {
    const s = stubCreate({ inserted: null });

    await NotificationService.notifyPostLike({ postOwnerId: 7, actorId: 4, postId: 50 });

    assert.equal(s.bump.mock.callCount(), 0); // likes are never "bumped"
    assert.equal(emitted.length, 0);
});

test("new-message notifications refresh the existing one instead of duplicating", async () => {
    const s = stubCreate({ inserted: null, bumped: 55, visible: row({ id: 55, type: "NEW_MESSAGE", extra: "latest" }) });

    await NotificationService.notifyNewMessage({ receiverId: 7, senderId: 4, conversationId: 12, content: "latest" });

    assert.equal(s.bump.mock.callCount(), 1);
    assert.deepEqual(s.bump.mock.calls[0].arguments[0], { recipientId: 7, actorId: 4, extra: "latest", dedupeKey: "NEW_MESSAGE:12" });
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].payload.notification.id, 55);
});

test("nothing is pushed when the notification is not visible to the recipient", async () => {
    stubCreate({ visible: null });
    await NotificationService.notifyPostLike({ postOwnerId: 7, actorId: 4, postId: 50 });
    assert.equal(emitted.length, 0);
});

test("a failing notification never breaks the action that triggered it", async () => {
    mock.method(NotificationRepository, "insertIfNew", async () => { throw new Error("db down"); });
    const err = mock.method(console, "error", () => {});

    await assert.doesNotReject(NotificationService.notifyPostLike({ postOwnerId: 7, actorId: 4, postId: 50 }));
    assert.equal(err.mock.callCount(), 1);
});

// ======================= listing / unread count =======================

test("list: pagination, offsets, unread count and the public shape", async () => {
    const find = mock.method(NotificationRepository, "findByRecipient", async () => [
        { ...row({ id: 9 }), recipient_id: 7, dedupe_key: "POST_LIKE:50:4", read_at: null },
        row({ id: 8, actor_id: null, actor_name: null, actor_photo: null, type: "ACCOUNT_STATUS", extra: "APPROVED", is_read: 1 }),
    ]);
    mock.method(NotificationRepository, "countByRecipient", async (id, opts) => (opts?.unreadOnly ? 4 : 45));

    const result = await NotificationService.list(7, { page: 3, limit: 20 });

    assert.deepEqual(find.mock.calls[0].arguments, [7, { limit: 20, offset: 40, unreadOnly: false }]);
    assert.deepEqual(result.pagination, { page: 3, limit: 20, total: 45, totalPages: 3 });
    assert.equal(result.unreadCount, 4);
    assert.deepEqual(Object.keys(result.notifications[0]).sort(), ["actor", "created_at", "extra", "id", "is_read", "reference_id", "type"]);
    assert.deepEqual(result.notifications[0].actor, { user_id: 4, full_name: "Asha Rao", profile_photo: "a.jpg" });
    assert.equal(result.notifications[0].is_read, false);
    assert.equal(result.notifications[1].actor, null); // system notice
    assert.equal(result.notifications[1].is_read, true);
    assert.equal(JSON.stringify(result).includes("dedupe_key"), false);
    assert.equal(JSON.stringify(result).includes("recipient_id"), false);
});

test("unread count only counts unread, visible notifications of the user", async () => {
    const count = mock.method(NotificationRepository, "countByRecipient", async () => 6);
    assert.deepEqual(await NotificationService.getUnreadCount(7), { count: 6 });
    assert.deepEqual(count.mock.calls[0].arguments, [7, { unreadOnly: true }]);
});

// ======================= read operations =======================

test("markRead marks only the signed-in user's notification and syncs their tabs", async () => {
    mock.method(NotificationRepository, "existsForRecipient", async () => true);
    const mark = mock.method(NotificationRepository, "markRead", async () => 1);
    mock.method(NotificationRepository, "countByRecipient", async () => 2);

    const result = await NotificationService.markRead(7, "15");

    assert.deepEqual(mark.mock.calls[0].arguments, [15, 7]);
    assert.deepEqual(result, { unreadCount: 2 });
    assert.deepEqual(emitted, [{ room: "user:7", event: "notifications_read", payload: { ids: [15], unreadCount: 2 } }]);
});

test("someone else's (or a missing) notification is a 404 and is never modified", async () => {
    const exists = mock.method(NotificationRepository, "existsForRecipient", async () => false);
    const mark = mock.method(NotificationRepository, "markRead", async () => 1);

    await assert.rejects(NotificationService.markRead(7, 15), { statusCode: 404 });

    assert.deepEqual(exists.mock.calls[0].arguments, [15, 7]); // ownership is checked against the viewer
    assert.equal(mark.mock.callCount(), 0);
    assert.equal(emitted.length, 0);
});

test("a non-numeric notification id is a 400", async () => {
    for (const bad of ["abc", "0", "-3", "1.5"]) {
        await assert.rejects(NotificationService.markRead(7, bad), { statusCode: 400 }, bad);
    }
});

test("marking read twice is harmless", async () => {
    mock.method(NotificationRepository, "existsForRecipient", async () => true);
    mock.method(NotificationRepository, "markRead", async () => 0); // already read
    mock.method(NotificationRepository, "countByRecipient", async () => 0);
    await assert.doesNotReject(NotificationService.markRead(7, 15));
});

test("markAllRead is scoped to the user and tells all their tabs", async () => {
    const all = mock.method(NotificationRepository, "markAllRead", async () => 5);

    const result = await NotificationService.markAllRead(7);

    assert.deepEqual(all.mock.calls[0].arguments, [7]);
    assert.deepEqual(result, { updated: 5, unreadCount: 0 });
    assert.deepEqual(emitted, [{ room: "user:7", event: "notifications_read", payload: { all: true, unreadCount: 0 } }]);
});

test("opening a conversation reads its message notification (and only then notifies tabs)", async () => {
    const byRef = mock.method(NotificationRepository, "markReadByReference", async () => 1);
    mock.method(NotificationRepository, "countByRecipient", async () => 0);

    await NotificationService.markMessageNotificationsRead(7, "12");
    assert.deepEqual(byRef.mock.calls[0].arguments, [7, "NEW_MESSAGE", "12"]);
    assert.deepEqual(emitted[0].payload, { type: "NEW_MESSAGE", referenceId: 12, unreadCount: 0 });

    emitted.length = 0;
    byRef.mock.mockImplementation(async () => 0); // nothing was unread
    await NotificationService.markMessageNotificationsRead(7, 12);
    assert.equal(emitted.length, 0);
});

test("deleting a post / cancelling a request removes its notifications and refreshes recipients", async () => {
    const del = mock.method(NotificationRepository, "deleteByReference", async () => [7, 8]);
    mock.method(NotificationRepository, "countByRecipient", async () => 0);

    await NotificationService.removePostNotifications(50);

    assert.deepEqual(del.mock.calls[0].arguments, [["POST_LIKE", "POST_COMMENT"], 50]);
    assert.deepEqual(emitted.map((e) => e.room), ["user:7", "user:8"]);

    emitted.length = 0;
    const byKey = mock.method(NotificationRepository, "deleteByDedupeKey", async () => [7]);
    await NotificationService.removeConnectionRequest(9);
    assert.equal(byKey.mock.calls[0].arguments[0], "CONNECTION_REQUEST:9");
    assert.equal(emitted[0].room, "user:7");
});

// ======================= the SQL that actually runs =======================

function captureSql(rowsToReturn = [[{ total: 0 }]]) {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql: sql.replace(/\s+/g, " "), params });
        return [rowsToReturn[0], []];
    });
    return calls;
}

test("every user-facing query is scoped to the recipient", async () => {
    const calls = captureSql();

    await NotificationRepository.findByRecipient(7, { limit: 20, offset: 0, unreadOnly: false });
    await NotificationRepository.countByRecipient(7, { unreadOnly: true });
    await NotificationRepository.findVisibleById(15, 7);
    await NotificationRepository.markRead(15, 7);
    await NotificationRepository.markAllRead(7);
    await NotificationRepository.existsForRecipient(15, 7);

    for (const { sql, params } of calls) {
        assert.match(sql, /recipient_id = \?/, sql);
        assert.ok(params.includes(7), `viewer id must be bound in: ${sql}`);
    }
});

test("lists and counts hide notifications from accounts that are no longer ACTIVE", async () => {
    const calls = captureSql();
    await NotificationRepository.findByRecipient(7, { limit: 20, offset: 0 });
    await NotificationRepository.countByRecipient(7);
    for (const { sql } of calls) {
        assert.match(sql, /\(n\.actor_id IS NULL OR a\.status = 'ACTIVE'\)/);
    }
});

test("the list SELECT exposes only public actor fields", async () => {
    const calls = captureSql();
    await NotificationRepository.findByRecipient(7, { limit: 20, offset: 0 });
    const select = calls[0].sql.slice(0, calls[0].sql.indexOf("FROM notifications"));
    for (const col of ["email", "enrollment", "mobile", "dob", "password", "dedupe_key", "recipient_id"]) {
        assert.equal(select.includes(col), false, `${col} must not be selected`);
    }
});

test("notifications are only created for ACTIVE recipients, and duplicates are ignored by the database", async () => {
    const calls = captureSql([{ affectedRows: 1, insertId: 5 }]);
    mock.restoreAll();
    const sqls = [];
    mock.method(pool, "execute", async (sql, params) => {
        sqls.push({ sql: sql.replace(/\s+/g, " "), params });
        return [{ affectedRows: 0, insertId: 0 }, []];
    });

    const id = await NotificationRepository.insertIfNew({ recipientId: 7, actorId: 4, type: "POST_LIKE", referenceId: 50, dedupeKey: "k" });

    assert.equal(id, null); // 0 affected rows = duplicate / inactive recipient
    assert.match(sqls[0].sql, /INSERT IGNORE INTO notifications/);
    assert.match(sqls[0].sql, /u\.status = 'ACTIVE'/);
    assert.equal(calls.length, 0);
});

// ======================= other modules create the right notifications =======================

test("sending a connection request notifies the receiver", async () => {
    const stubs = stubNotifications(mock);
    mock.method(userRepository, "findUserById", async () => ({ id: 9, status: "ACTIVE" }));
    mock.method(ConnectionRepository, "findConnection", async () => undefined);
    mock.method(ConnectionRepository, "createConnection", async () => 31);

    await ConnectionService.sendRequest(4, "9");

    assert.deepEqual(stubs.notifyConnectionRequest.mock.calls[0].arguments[0], { senderId: 4, receiverId: 9, connectionId: 31 });
});

test("accepting notifies the original sender and settles the request notification", async () => {
    const stubs = stubNotifications(mock);
    mock.method(ConnectionRepository, "findConnectionById", async () => ({ id: 31, sender_id: 4, receiver_id: 9, status: "PENDING" }));
    mock.method(ConnectionRepository, "updateStatus", async () => 1);

    await ConnectionService.acceptRequest(9, 31);

    assert.deepEqual(stubs.notifyConnectionAccepted.mock.calls[0].arguments[0], { accepterId: 9, senderId: 4, connectionId: 31 });
    assert.deepEqual(stubs.markConnectionRequestHandled.mock.calls[0].arguments, [31]);
});

test("rejecting settles the request notification; cancelling removes it", async () => {
    const stubs = stubNotifications(mock);
    mock.method(ConnectionRepository, "findConnectionById", async () => ({ id: 31, sender_id: 4, receiver_id: 9, status: "PENDING" }));
    mock.method(ConnectionRepository, "updateStatus", async () => 1);

    await ConnectionService.rejectRequest(9, 31);
    assert.deepEqual(stubs.markConnectionRequestHandled.mock.calls[0].arguments, [31]);
    assert.equal(stubs.notifyConnectionAccepted.mock.callCount(), 0);

    await ConnectionService.cancelRequest(4, 31);
    assert.deepEqual(stubs.removeConnectionRequest.mock.calls[0].arguments, [31]);
});

test("a failed connection action does not notify", async () => {
    const stubs = stubNotifications(mock);
    mock.method(ConnectionRepository, "findConnectionById", async () => ({ id: 31, sender_id: 4, receiver_id: 9, status: "ACCEPTED" }));

    await assert.rejects(ConnectionService.acceptRequest(9, 31), { statusCode: 400 }); // not pending
    await assert.rejects(ConnectionService.acceptRequest(5, 31), { statusCode: 403 }); // not the receiver
    assert.equal(stubs.notifyConnectionAccepted.mock.callCount(), 0);
});

test("a notification failure does not stop a connection request from succeeding", async () => {
    mock.method(userRepository, "findUserById", async () => ({ id: 9, status: "ACTIVE" }));
    mock.method(ConnectionRepository, "findConnection", async () => undefined);
    mock.method(ConnectionRepository, "createConnection", async () => 31);
    mock.method(NotificationRepository, "insertIfNew", async () => { throw new Error("db down"); });
    mock.method(console, "error", () => {});

    assert.equal(await ConnectionService.sendRequest(4, 9), 31);
});

test("liking and commenting notify the post's owner, not the post's actor", async () => {
    const stubs = stubNotifications(mock);
    mock.method(PostRepository, "findPostById", async () => ({ id: 50, user_id: 7, status: "ACTIVE", deleted_at: null }));
    mock.method(PostRepository, "findLike", async () => undefined);
    mock.method(PostRepository, "createLike", async () => 1);
    mock.method(PostRepository, "createComment", async () => 88);

    await PostService.likePost(4, 50);
    assert.deepEqual(stubs.notifyPostLike.mock.calls[0].arguments[0], { postOwnerId: 7, actorId: 4, postId: 50 });

    await PostService.addComment(4, 50, "nice post");
    assert.deepEqual(stubs.notifyPostComment.mock.calls[0].arguments[0], {
        postOwnerId: 7, actorId: 4, postId: 50, commentId: 88, content: "nice post",
    });
});

test("a refused like (deleted post / already liked) does not notify", async () => {
    const stubs = stubNotifications(mock);
    mock.method(PostRepository, "findPostById", async () => ({ id: 50, user_id: 7, status: "ACTIVE", deleted_at: null }));
    mock.method(PostRepository, "findLike", async () => ({ id: 1 }));
    await assert.rejects(PostService.likePost(4, 50), { statusCode: 409 });

    mock.method(PostRepository, "findPostById", async () => undefined);
    await assert.rejects(PostService.likePost(4, 99), { statusCode: 404 });

    assert.equal(stubs.notifyPostLike.mock.callCount(), 0);
});

test("deleting a comment removes its notification", async () => {
    const stubs = stubNotifications(mock);
    mock.method(PostRepository, "findCommentById", async () => ({ id: 88, post_id: 50, user_id: 4 }));
    mock.method(PostRepository, "deleteComment", async () => 1);

    await PostService.deleteComment(4, 88);

    assert.deepEqual(stubs.removeCommentNotification.mock.calls[0].arguments, [88]);
});

test("sending a message notifies the other participant; opening the chat reads it", async () => {
    const stubs = stubNotifications(mock);
    mock.method(ConversationRepository, "findConversationById", async () => ({ id: 12, user_one_id: 4, user_two_id: 7 }));
    mock.method(ConnectionRepository, "findConnection", async () => ({ id: 1, status: "ACCEPTED" }));
    mock.method(ConversationRepository, "createMessage", async () => 500);
    mock.method(ConversationRepository, "markConversationRead", async () => 1);

    await ConversationService.sendMessage(12, 4, "  hello ");
    assert.deepEqual(stubs.notifyNewMessage.mock.calls[0].arguments[0], { receiverId: 7, senderId: 4, conversationId: 12, content: "hello" });

    await ConversationService.markConversationRead(7, 12);
    assert.deepEqual(stubs.markMessageNotificationsRead.mock.calls[0].arguments, [7, 12]);
});

test("a refused message (no ACCEPTED connection) creates no notification", async () => {
    const stubs = stubNotifications(mock);
    mock.method(ConversationRepository, "findConversationById", async () => ({ id: 12, user_one_id: 4, user_two_id: 7 }));
    mock.method(ConnectionRepository, "findConnection", async () => ({ id: 1, status: "REMOVED" }));
    mock.method(ConversationRepository, "createMessage", async () => 500);

    await assert.rejects(ConversationService.sendMessage(12, 4, "hi"), { statusCode: 403 });
    assert.equal(stubs.notifyNewMessage.mock.callCount(), 0);
});

test("admin approval / reinstatement notifies the user; blocking and rejecting do not", async () => {
    const stubs = stubNotifications(mock);
    let current = { id: 7, status: "PENDING" };
    mock.method(userRepository, "findUserById", async () => current);
    mock.method(userRepository, "updateUserStatus", async () => 1);

    await UserService.updateUserStatus(7, "ACTIVE", 1);
    assert.deepEqual(stubs.notifyAccountActivated.mock.calls[0].arguments[0], { userId: 7, previousStatus: "PENDING" });

    current = { id: 7, status: "BLOCKED" };
    await UserService.updateUserStatus(7, "ACTIVE", 1);
    assert.equal(stubs.notifyAccountActivated.mock.calls[1].arguments[0].previousStatus, "BLOCKED");

    current = { id: 7, status: "ACTIVE" };
    await UserService.updateUserStatus(7, "BLOCKED", 1);
    current = { id: 8, status: "PENDING" };
    await UserService.updateUserStatus(8, "REJECTED", 1, "not a student");
    assert.equal(stubs.notifyAccountActivated.mock.callCount(), 2);
});

// ======================= HTTP API =======================

let server, base;

before(async () => {
    const app = express();
    app.use("/api/notifications", notificationRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/notifications`;
});
after(() => server.close());

const authHeader = (userId = 5) => ({
    Authorization: `Bearer ${jwt.sign({ userId, role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
});
const liveSession = (userId = 5) =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role: "STUDENT", status: "ACTIVE" }));

test("HTTP: every notification endpoint requires a signed-in user", async () => {
    for (const [method, path] of [["GET", ""], ["GET", "/unread-count"], ["PATCH", "/read-all"], ["PATCH", "/3/read"]]) {
        const res = await fetch(`${base}${path}`, { method });
        assert.equal(res.status, 401, `${method} ${path}`);
    }
});

test("HTTP: list returns the viewer's notifications, taken from the token", async () => {
    liveSession(5);
    const find = mock.method(NotificationRepository, "findByRecipient", async () => [row({ id: 2 })]);
    mock.method(NotificationRepository, "countByRecipient", async () => 1);

    const res = await fetch(`${base}?page=1&limit=10&unreadOnly=true`, { headers: authHeader(5) });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.data.notifications[0].id, 2);
    assert.deepEqual(body.data.pagination, { page: 1, limit: 10, total: 1, totalPages: 1 });
    assert.deepEqual(find.mock.calls[0].arguments, [5, { limit: 10, offset: 0, unreadOnly: true }]);
});

test("HTTP: list rejects out-of-range paging", async () => {
    liveSession();
    assert.equal((await fetch(`${base}?limit=500`, { headers: authHeader() })).status, 400);
    assert.equal((await fetch(`${base}?page=0`, { headers: authHeader() })).status, 400);
    assert.equal((await fetch(`${base}?unreadOnly=maybe`, { headers: authHeader() })).status, 400);
});

test("HTTP: unread count", async () => {
    liveSession();
    mock.method(NotificationRepository, "countByRecipient", async () => 8);
    const body = await (await fetch(`${base}/unread-count`, { headers: authHeader() })).json();
    assert.deepEqual(body.data, { count: 8 });
});

test("HTTP: read-all is routed to mark-all, not mistaken for an :id", async () => {
    liveSession(5);
    const all = mock.method(NotificationRepository, "markAllRead", async () => 3);
    const one = mock.method(NotificationRepository, "markRead", async () => 1);

    const res = await fetch(`${base}/read-all`, { method: "PATCH", headers: authHeader(5) });

    assert.equal(res.status, 200);
    assert.deepEqual(all.mock.calls[0].arguments, [5]);
    assert.equal(one.mock.callCount(), 0);
});

test("HTTP: mark one as read - own notification works, another user's is a 404, a bad id is a 400", async () => {
    liveSession(5);
    const exists = mock.method(NotificationRepository, "existsForRecipient", async (id, user) => user === 5 && id === 3);
    const mark = mock.method(NotificationRepository, "markRead", async () => 1);
    mock.method(NotificationRepository, "countByRecipient", async () => 0);

    assert.equal((await fetch(`${base}/3/read`, { method: "PATCH", headers: authHeader(5) })).status, 200);
    assert.deepEqual(mark.mock.calls[0].arguments, [3, 5]);

    assert.equal((await fetch(`${base}/4/read`, { method: "PATCH", headers: authHeader(5) })).status, 404);
    assert.equal(mark.mock.callCount(), 1);

    assert.equal((await fetch(`${base}/abc/read`, { method: "PATCH", headers: authHeader(5) })).status, 400);
    assert.equal(exists.mock.callCount(), 2);
});

test("HTTP: a blocked user's token cannot read notifications", async () => {
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 5, role: "STUDENT", status: "BLOCKED" }));
    assert.equal((await fetch(base, { headers: authHeader(5) })).status, 401);
});
