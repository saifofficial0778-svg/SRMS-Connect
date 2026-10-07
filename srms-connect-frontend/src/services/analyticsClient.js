const EMPTY_METRIC = { value: 0, previous: 0, change_percent: null };
const EMPTY_AUDIENCE = { roles: [], companies: [], designations: [] };

const pageOf = (pagination, page, limit) => ({
  page: pagination?.page || page,
  limit: pagination?.limit || limit,
  total: pagination?.total || 0,
  totalPages: pagination?.totalPages || 1,
});

// Talks to /api/analytics and /api/posts/mine. The HTTP client is injected so it can be tested
// without axios; analyticsService.js wires in the real authenticated instance.
// Whose analytics is never sent: the server always answers for the signed-in user.
export function createAnalyticsClient(http) {
  const data = (response) => response.data?.data;

  async function getOverview(days) {
    const d = data(await http.get("/analytics/overview", { params: { days } })) || {};
    const totals = d.totals || {};
    const metric = (key) => ({ ...EMPTY_METRIC, ...(totals[key] || {}) });
    return {
      range: d.range || { days },
      totals: {
        post_impressions: metric("post_impressions"),
        post_reach: metric("post_reach"),
        engagements: metric("engagements"),
        likes: metric("likes"),
        comments: metric("comments"),
        engagement_rate: Number(totals.engagement_rate) || 0,
        profile_views: metric("profile_views"),
        profile_viewers: metric("profile_viewers"),
        search_appearances: metric("search_appearances"),
        searchers: metric("searchers"),
      },
      series: d.series || [],
      searchers: { ...EMPTY_AUDIENCE, ...(d.searchers || {}) },
      profile_audience: { ...EMPTY_AUDIENCE, ...(d.profile_audience || {}) },
      definitions: d.definitions || {},
    };
  }

  async function getPostStats({ days, sort = "recent" }, page = 1, limit = 10) {
    const d = data(await http.get("/analytics/posts", { params: { days, sort, page, limit } })) || {};
    return { posts: d.posts || [], pagination: pageOf(d.pagination, page, limit) };
  }

  async function getProfileViewers(days, page = 1, limit = 10) {
    const d = data(await http.get("/analytics/profile-viewers", { params: { days, page, limit } })) || {};
    return { viewers: d.viewers || [], totalViews: d.total_views || 0, pagination: pageOf(d.pagination, page, limit) };
  }

  // post ids that were on this user's screen; the viewer is the session, never part of the body
  async function recordImpressions(postIds) {
    const ids = [...new Set((postIds || []).map(Number))].filter((id) => Number.isInteger(id) && id > 0).slice(0, 50);
    if (ids.length === 0) return;
    await http.post("/analytics/impressions", { post_ids: ids });
  }

  // the signed-in member's own posts with each post's numbers; there is no way to ask for someone else's
  async function getMyPosts(page = 1, limit = 12) {
    const d = data(await http.get("/posts/mine", { params: { page, limit } })) || {};
    return { posts: d.posts || [], pagination: pageOf(d.pagination, page, limit) };
  }

  return { getOverview, getPostStats, getProfileViewers, recordImpressions, getMyPosts };
}
