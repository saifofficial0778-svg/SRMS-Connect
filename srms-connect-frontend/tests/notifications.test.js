import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers";

import { bellLabel, describeNotification, formatBadgeCount } from "../src/utils/notificationFormat.js";
import { createNotificationClient } from "../src/services/notificationClient.js";
import { createNotificationStore } from "../src/services/notificationStore.js";

const flush = () => new Promise((r) => setImmediate(r));

const note = (id, over = {}) => ({
  id,
  type: "POST_LIKE",
  reference_id: 50,
  extra: null,
  is_read: false,
  created_at: "2026-01-01T10:00:00.000Z",
  actor: { user_id: 4, full_name: "Asha Rao", profile_photo: null },
  ...over,
});

// ======================= what a notification says and where it goes =======================

test("each type reads naturally and links to the right place", () => {
  const request = describeNotification(note(1, { type: "CONNECTION_REQUEST", reference_id: 9 }));
  assert.equal(request.actorName, "Asha Rao");
  assert.equal(request.message, "sent you a connection request");
  assert.equal(request.to, "/network");
  assert.deepEqual(request.state, { tab: "received" }); // opens on the Requests tab

  const accepted = describeNotification(note(2, { type: "CONNECTION_ACCEPTED" }));
  assert.equal(accepted.message, "accepted your connection request");
  assert.equal(accepted.to, "/profile/4"); // their profile

  assert.equal(describeNotification(note(3, { type: "POST_LIKE" })).message, "liked your post");
  assert.equal(describeNotification(note(3, { type: "POST_LIKE" })).to, "/home");

  const comment = describeNotification(note(4, { type: "POST_COMMENT", extra: "great post!" }));
  assert.equal(comment.message, "commented on your post");
  assert.equal(comment.preview, "great post!");
  assert.equal(comment.to, "/home");

  const message = describeNotification(note(5, { type: "NEW_MESSAGE", reference_id: 12, extra: "hello" }));
  assert.equal(message.message, "sent you a message");
  assert.equal(message.preview, "hello");
  assert.equal(message.to, "/chat");
  assert.deepEqual(message.state, { conversationId: 12, userId: 4 }); // opens that conversation
});

test("account notices are shown as from SRMS Connect, never from an admin", () => {
  const approved = describeNotification(note(6, { type: "ACCOUNT_STATUS", extra: "APPROVED", actor: null }));
  assert.equal(approved.actorName, "SRMS Connect");
  assert.match(approved.message, /approved/);
  assert.match(describeNotification(note(7, { type: "ACCOUNT_STATUS", extra: "REINSTATED", actor: null })).message, /reinstated/);
});

test("missing actors and unknown types never crash the list", () => {
  assert.equal(describeNotification(note(8, { type: "POST_LIKE", actor: null })).actorName, "Someone");
  assert.equal(describeNotification(note(9, { type: "CONNECTION_ACCEPTED", actor: null })).to, "/network");
  const unknown = describeNotification(note(10, { type: "SOMETHING_NEW" }));
  assert.equal(unknown.to, null); // not clickable rather than a broken link
  assert.equal(describeNotification(undefined).to, null);
});

test("badge never overflows and the bell label announces the count", () => {
  assert.equal(formatBadgeCount(0), "");
  assert.equal(formatBadgeCount(7), "7");
  assert.equal(formatBadgeCount(99), "99");
  assert.equal(formatBadgeCount(250), "99+");
  assert.equal(bellLabel(0), "Notifications");
  assert.equal(bellLabel(3), "Notifications, 3 unread");
});

// ======================= API client =======================

function fakeHttp(responses = {}) {
  const calls = [];
  const respond = (method) => async (url, config) => {
    calls.push({ method, url, config });
    return { data: { data: responses[`${method} ${url}`] } };
  };
  return { calls, get: respond("GET"), patch: respond("PATCH") };
}

test("client calls the notification endpoints and normalises responses", async () => {
  const http = fakeHttp({
    "GET /notifications": { notifications: [note(1)], unreadCount: 4, pagination: { page: 2, totalPages: 5 } },
    "GET /notifications/unread-count": { count: 4 },
    "PATCH /notifications/7/read": { unreadCount: 3 },
  });
  const client = createNotificationClient(http);

  assert.deepEqual(await client.list(2, 10), { notifications: [note(1)], unreadCount: 4, page: 2, totalPages: 5 });
  assert.deepEqual(http.calls[0].config.params, { page: 2, limit: 10 });
  assert.equal(await client.getUnreadCount(), 4);
  assert.equal(await client.markRead(7), 3);
  await client.markAllRead();
  assert.deepEqual(http.calls.at(-1), { method: "PATCH", url: "/notifications/read-all", config: undefined });
});

test("client tolerates empty bodies", async () => {
  const client = createNotificationClient(fakeHttp());
  assert.deepEqual(await client.list(), { notifications: [], unreadCount: 0, page: 1, totalPages: 1 });
  assert.equal(await client.getUnreadCount(), 0);
  assert.equal(await client.markRead(1), undefined);
});

// ======================= store: the whole bell flow =======================

// a controllable fake backend
function fakeClient({ pages = [[]], unread = 0 } = {}) {
  const calls = { list: [], markRead: [], markAllRead: 0, unread: 0 };
  const client = {
    calls,
    fail: { list: false, markRead: false, markAllRead: false },
    async list(page) {
      calls.list.push(page);
      if (client.fail.list) throw new Error("network");
      return { notifications: pages[page - 1] || [], unreadCount: unread, page, totalPages: pages.length };
    },
    async markRead(id) {
      calls.markRead.push(id);
      if (client.fail.markRead) throw new Error("network");
      return Math.max(0, unread - 1);
    },
    async markAllRead() {
      calls.markAllRead++;
      if (client.fail.markAllRead) throw new Error("network");
    },
    async getUnreadCount() {
      calls.unread++;
      return unread;
    },
  };
  return client;
}

test("load: shows loading then the first page with the server's unread count", async () => {
  const client = fakeClient({ pages: [[note(2), note(1, { is_read: true })]], unread: 1 });
  const store = createNotificationStore(client);
  const seen = [];
  store.subscribe(() => seen.push(store.getState().status));

  const loading = store.load();
  assert.equal(store.getState().status, "loading");
  await loading;

  const s = store.getState();
  assert.equal(s.status, "ready");
  assert.deepEqual(s.items.map((n) => n.id), [2, 1]);
  assert.equal(s.unreadCount, 1);
  assert.deepEqual(seen, ["loading", "ready"]);
});

test("load failure: an empty bell shows an error with retry; existing items are kept", async () => {
  const client = fakeClient({ pages: [[note(1)]], unread: 1 });
  const store = createNotificationStore(client);

  client.fail.list = true;
  await store.load();
  assert.equal(store.getState().status, "error");

  client.fail.list = false;
  await store.load(); // "Try again"
  assert.equal(store.getState().status, "ready");

  client.fail.list = true;
  await store.load({ silent: true }); // a failed background refresh must not wipe the list
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().items.length, 1);
});

test("loadMore appends the next page, skips duplicates, and stops at the last page", async () => {
  const client = fakeClient({ pages: [[note(3), note(2)], [note(2), note(1)]], unread: 3 });
  const store = createNotificationStore(client, { pageSize: 2 });
  await store.load();

  await store.loadMore();
  assert.deepEqual(store.getState().items.map((n) => n.id), [3, 2, 1]); // id 2 not duplicated
  assert.equal(store.getState().page, 2);

  await store.loadMore(); // already on the last page
  assert.deepEqual(client.calls.list, [1, 2]);
});

test("loadMore ignores a second click while a page is loading", async () => {
  const client = fakeClient({ pages: [[note(2)], [note(1)]] });
  const store = createNotificationStore(client);
  await store.load();

  const first = store.loadMore();
  const second = store.loadMore();
  await Promise.all([first, second]);

  assert.deepEqual(client.calls.list, [1, 2]);
});

test("real-time: a pushed notification appears at the top and updates the badge", async () => {
  const store = createNotificationStore(fakeClient({ pages: [[note(1)]], unread: 1 }));
  await store.load();

  store.receive({ notification: note(2, { type: "POST_COMMENT" }), unreadCount: 2 });

  assert.deepEqual(store.getState().items.map((n) => n.id), [2, 1]);
  assert.equal(store.getState().unreadCount, 2);
});

test("real-time: a refreshed notification (new message in a chat) replaces the old one instead of duplicating", async () => {
  const store = createNotificationStore(fakeClient({
    pages: [[note(5, { type: "NEW_MESSAGE", extra: "hi", is_read: true }), note(1)]],
    unread: 1,
  }));
  await store.load();

  store.receive({ notification: note(5, { type: "NEW_MESSAGE", extra: "are you there?" }), unreadCount: 2 });

  const items = store.getState().items;
  assert.deepEqual(items.map((n) => n.id), [5, 1]); // moved to top, not repeated
  assert.equal(items[0].extra, "are you there?");
  assert.equal(items[0].is_read, false);
  assert.equal(store.getState().unreadCount, 2);
});

test("real-time without a server count adjusts the badge by itself", async () => {
  const store = createNotificationStore(fakeClient({ pages: [[note(1, { is_read: true })]], unread: 0 }));
  await store.load();

  store.receive({ notification: note(2) });
  assert.equal(store.getState().unreadCount, 1);

  store.receive({ notification: note(2) }); // same unread one again: still 1
  assert.equal(store.getState().unreadCount, 1);

  store.receive({}); // malformed push is ignored
  assert.equal(store.getState().items.length, 2);
});

test("mark one read: instant UI update, then the server's count wins", async () => {
  const client = fakeClient({ pages: [[note(2), note(1)]], unread: 2 });
  const store = createNotificationStore(client);
  await store.load();

  const pending = store.markRead(2);
  assert.equal(store.getState().items[0].is_read, true); // optimistic
  assert.equal(store.getState().unreadCount, 1);
  assert.equal(await pending, true);

  assert.deepEqual(client.calls.markRead, [2]);
  assert.equal(store.getState().unreadCount, 1);
});

test("marking an already-read notification sends no request", async () => {
  const client = fakeClient({ pages: [[note(1, { is_read: true })]], unread: 0 });
  const store = createNotificationStore(client);
  await store.load();

  assert.equal(await store.markRead(1), true);
  assert.equal(await store.markRead(999), true); // unknown id
  assert.deepEqual(client.calls.markRead, []);
  assert.equal(store.getState().unreadCount, 0);
});

test("mark one read rolls back when the request fails", async () => {
  const client = fakeClient({ pages: [[note(2), note(1)]], unread: 2 });
  const store = createNotificationStore(client);
  await store.load();

  client.fail.markRead = true;
  assert.equal(await store.markRead(2), false);

  assert.equal(store.getState().items[0].is_read, false);
  assert.equal(store.getState().unreadCount, 2);
});

test("mark all read: everything read and badge cleared; rolled back on failure", async () => {
  const client = fakeClient({ pages: [[note(3), note(2), note(1, { is_read: true })]], unread: 2 });
  const store = createNotificationStore(client);
  await store.load();

  client.fail.markAllRead = true;
  assert.equal(await store.markAllRead(), false);
  assert.equal(store.getState().unreadCount, 2);
  assert.equal(store.getState().items.filter((n) => !n.is_read).length, 2);

  client.fail.markAllRead = false;
  assert.equal(await store.markAllRead(), true);
  assert.equal(store.getState().unreadCount, 0);
  assert.ok(store.getState().items.every((n) => n.is_read));
});

test("mark all read does nothing when there is nothing unread", async () => {
  const client = fakeClient({ pages: [[note(1, { is_read: true })]], unread: 0 });
  const store = createNotificationStore(client);
  await store.load();
  await store.markAllRead();
  assert.equal(client.calls.markAllRead, 0);
});

test("sync from another tab: all / ids / a conversation's message notification", async () => {
  const items = [note(4, { type: "NEW_MESSAGE", reference_id: 12 }), note(3), note(2), note(1)];
  const store = createNotificationStore(fakeClient({ pages: [items], unread: 4 }));
  await store.load();

  store.applyReadSync({ ids: [3], unreadCount: 3 });
  assert.equal(store.getState().items.find((n) => n.id === 3).is_read, true);
  assert.equal(store.getState().unreadCount, 3);

  store.applyReadSync({ type: "NEW_MESSAGE", referenceId: 12, unreadCount: 2 }); // chat opened elsewhere
  assert.equal(store.getState().items.find((n) => n.id === 4).is_read, true);
  assert.equal(store.getState().items.find((n) => n.id === 2).is_read, false); // other types untouched

  store.applyReadSync({ all: true, unreadCount: 0 });
  assert.ok(store.getState().items.every((n) => n.is_read));
  assert.equal(store.getState().unreadCount, 0);
});

test("when the server removed notifications, the list is refetched in the background", async () => {
  const client = fakeClient({ pages: [[note(2), note(1)]], unread: 2 });
  const store = createNotificationStore(client);
  await store.load();
  assert.deepEqual(client.calls.list, [1]);

  store.applyReadSync({ removed: true, unreadCount: 1 });
  await flush();

  assert.deepEqual(client.calls.list, [1, 1]);
  assert.equal(store.getState().status, "ready"); // no flash of "loading"
});

test("a slow older load never overwrites a newer one", async () => {
  const resolvers = [];
  const client = {
    list: () => new Promise((resolve) => resolvers.push(resolve)),
  };
  const store = createNotificationStore(client);

  const older = store.load();
  const newer = store.load({ silent: true });
  resolvers[1]({ notifications: [note(9)], unreadCount: 1, page: 1, totalPages: 1 });
  await newer;
  resolvers[0]({ notifications: [note(1)], unreadCount: 5, page: 1, totalPages: 1 }); // arrives late
  await older;

  assert.deepEqual(store.getState().items.map((n) => n.id), [9]);
  assert.equal(store.getState().unreadCount, 1);
});

test("subscribers are notified of changes and can unsubscribe", async () => {
  const store = createNotificationStore(fakeClient({ pages: [[note(1)]], unread: 1 }));
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);

  await store.load();
  const afterLoad = calls;
  assert.ok(afterLoad > 0);

  unsubscribe();
  store.receive({ notification: note(2), unreadCount: 2 });
  assert.equal(calls, afterLoad);
});

test("reset clears everything (used when the signed-in user changes)", async () => {
  const store = createNotificationStore(fakeClient({ pages: [[note(1)]], unread: 1 }));
  await store.load();
  store.reset();
  assert.deepEqual(store.getState().items, []);
  assert.equal(store.getState().unreadCount, 0);
  assert.equal(store.getState().status, "idle");
});

test("refreshUnread re-syncs only the badge", async () => {
  const client = fakeClient({ pages: [[]], unread: 6 });
  const store = createNotificationStore(client);
  await store.refreshUnread();
  assert.equal(store.getState().unreadCount, 6);
});

// ======================= the full flow a user goes through =======================

test("flow: bell loads, a live notification arrives, clicking it marks it read and navigates", async () => {
  const client = fakeClient({ pages: [[note(1, { is_read: true })]], unread: 0 });
  const store = createNotificationStore(client);
  await store.load();
  assert.equal(formatBadgeCount(store.getState().unreadCount), ""); // no badge yet

  // socket push: Asha sent a message
  store.receive({
    notification: note(2, { type: "NEW_MESSAGE", reference_id: 12, extra: "hey!" }),
    unreadCount: 1,
  });
  assert.equal(formatBadgeCount(store.getState().unreadCount), "1");
  assert.equal(bellLabel(store.getState().unreadCount), "Notifications, 1 unread");

  // the user clicks the first item in the dropdown
  const clicked = store.getState().items[0];
  const { to, state } = describeNotification(clicked);
  await store.markRead(clicked.id);

  assert.equal(to, "/chat");
  assert.deepEqual(state, { conversationId: 12, userId: 4 });
  assert.equal(formatBadgeCount(store.getState().unreadCount), "");
  assert.deepEqual(client.calls.markRead, [2]);
});
