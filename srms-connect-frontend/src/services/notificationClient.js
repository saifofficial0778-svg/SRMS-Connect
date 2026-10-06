// Talks to /api/notifications. The HTTP client is injected so it can be tested without axios;
// notificationService.js wires in the real authenticated instance.
export function createNotificationClient(http) {
  async function list(page = 1, limit = 20) {
    const response = await http.get("/notifications", { params: { page, limit } });
    const data = response.data?.data || {};
    const pagination = data.pagination || {};
    return {
      notifications: data.notifications || [],
      unreadCount: data.unreadCount || 0,
      page: pagination.page || page,
      totalPages: pagination.totalPages || 1,
    };
  }

  async function getUnreadCount() {
    const response = await http.get("/notifications/unread-count");
    return response.data?.data?.count || 0;
  }

  async function markRead(id) {
    const response = await http.patch(`/notifications/${id}/read`);
    return response.data?.data?.unreadCount;
  }

  async function markAllRead() {
    await http.patch("/notifications/read-all");
  }

  return { list, getUnreadCount, markRead, markAllRead };
}
