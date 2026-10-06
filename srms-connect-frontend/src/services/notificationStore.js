// All notification state and behaviour, independent of React: the bell reads it with
// useSyncExternalStore and the socket listeners call receive()/applyReadSync().
// Keeping it here means the whole flow (load, real-time updates, mark read, rollback on failure)
// is covered by plain-Node tests.

const initialState = () => ({
  items: [],
  unreadCount: 0,
  page: 0,
  totalPages: 1,
  status: "idle", // idle | loading | ready | error
  loadingMore: false,
});

const clampCount = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

export function createNotificationStore(client, { pageSize = 20 } = {}) {
  let state = initialState();
  const listeners = new Set();
  let loadSeq = 0; // a newer load makes older, slower responses irrelevant

  const set = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const getState = () => state;

  // First page. `silent` refreshes in the background without flipping the list to "loading"
  // (used after reconnects and when the server says notifications were removed).
  async function load({ silent = false } = {}) {
    const seq = ++loadSeq;
    if (!silent && state.items.length === 0) set({ status: "loading" });

    try {
      const data = await client.list(1, pageSize);
      if (seq !== loadSeq) return;
      set({
        items: data.notifications,
        unreadCount: data.unreadCount,
        page: data.page,
        totalPages: data.totalPages,
        status: "ready",
      });
    } catch {
      if (seq !== loadSeq) return;
      // keep showing what we have; only an empty list becomes an error state
      set({ status: state.items.length ? "ready" : "error" });
    }
  }

  async function loadMore() {
    if (state.loadingMore || state.page >= state.totalPages) return;
    set({ loadingMore: true });
    try {
      const data = await client.list(state.page + 1, pageSize);
      const known = new Set(state.items.map((n) => n.id));
      set({
        items: [...state.items, ...data.notifications.filter((n) => !known.has(n.id))],
        page: data.page,
        totalPages: data.totalPages,
        loadingMore: false,
      });
    } catch {
      set({ loadingMore: false });
    }
  }

  // socket: { notification, unreadCount }. An id we already have (e.g. a conversation's refreshed
  // "new message") replaces the old entry and moves to the top instead of appearing twice.
  function receive({ notification, unreadCount } = {}) {
    if (!notification) return;
    const previous = state.items.find((n) => n.id === notification.id);
    const rest = state.items.filter((n) => n.id !== notification.id);
    // without a server-provided count, adjust by how this entry's unread state changed
    const delta = (notification.is_read ? 0 : 1) - (previous && !previous.is_read ? 1 : 0);
    set({
      items: [notification, ...rest],
      unreadCount: typeof unreadCount === "number" ? unreadCount : clampCount(state.unreadCount + delta),
    });
  }

  // socket: the server changed read state / removed rows (possibly from another tab)
  //   { all }                  everything was marked read
  //   { ids }                  those were marked read
  //   { type, referenceId }    e.g. the message notification of a conversation that was opened
  //   { removed }              rows were deleted server-side -> refetch to drop them
  function applyReadSync({ ids, all, type, referenceId, removed, unreadCount } = {}) {
    const items = state.items.map((n) => {
      if (n.is_read) return n;
      const hit =
        all ||
        (ids && ids.includes(n.id)) ||
        (type && n.type === type && Number(n.reference_id) === Number(referenceId));
      return hit ? { ...n, is_read: true } : n;
    });
    set({ items, unreadCount: typeof unreadCount === "number" ? unreadCount : state.unreadCount });
    if (removed) load({ silent: true });
  }

  // Optimistic: the UI updates instantly and is rolled back if the request fails.
  async function markRead(id) {
    const target = state.items.find((n) => n.id === id);
    if (!target || target.is_read) return true;

    const before = { items: state.items, unreadCount: state.unreadCount };
    set({
      items: state.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: clampCount(state.unreadCount - 1),
    });

    try {
      const serverCount = await client.markRead(id);
      if (typeof serverCount === "number") set({ unreadCount: serverCount });
      return true;
    } catch {
      // restore only this notification; other changes made meanwhile are kept
      set({
        items: state.items.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
        unreadCount: before.unreadCount,
      });
      return false;
    }
  }

  async function markAllRead() {
    if (state.unreadCount === 0 && state.items.every((n) => n.is_read)) return true;

    const before = { items: state.items, unreadCount: state.unreadCount };
    set({ items: state.items.map((n) => (n.is_read ? n : { ...n, is_read: true })), unreadCount: 0 });

    try {
      await client.markAllRead();
      return true;
    } catch {
      set(before);
      return false;
    }
  }

  // cheap re-sync of the badge only
  async function refreshUnread() {
    try {
      set({ unreadCount: await client.getUnreadCount() });
    } catch {
      // keep the current badge
    }
  }

  function reset() {
    loadSeq++;
    state = initialState();
    listeners.forEach((l) => l());
  }

  return { subscribe, getState, load, loadMore, receive, applyReadSync, markRead, markAllRead, refreshUnread, reset };
}
