const AnalyticsRepository = require("./analytics.repository");
const NotificationService = require("../notification/notification.service");
const { DEFINITIONS, UNTRACKED_VIEWER_ROLES } = require("./analytics.constants");

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");
// calendar day in the server's own time zone - the same day MySQL's CURDATE() writes
const toDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// The period being looked at and the equally long period right before it.
//   days = 7, today = 10th  ->  current 4th..10th, previous 27th..3rd
function periods(days, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const back = (n) => new Date(today.getTime() - n * DAY_MS);
    return {
        days,
        from: toDay(back(days - 1)),
        to: toDay(today),
        previousFrom: toDay(back(2 * days - 1)),
        previousTo: toDay(back(days)),
    };
}

// every day of the period, oldest first
function daysBetween(from, to) {
    const out = [];
    const [y, m, d] = from.split("-").map(Number);
    for (let cursor = new Date(y, m - 1, d); toDay(cursor) <= to; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
        out.push(toDay(cursor));
    }
    return out;
}

// change against the previous period; null when there is nothing to compare with
function metric(value, previous) {
    const change = previous > 0 ? Math.round(((value - previous) / previous) * 1000) / 10 : null;
    return { value, previous, change_percent: change };
}

const rate = (engagements, impressions) => (impressions > 0 ? Math.round((engagements / impressions) * 1000) / 10 : 0);

// A recording failure must never break the page that triggered it (feed, profile, search).
async function safely(label, fn) {
    try {
        return await fn();
    } catch (error) {
        console.error(`[analytics] ${label} failed:`, error.message);
        return null;
    }
}

const isTracked = (viewer) => Boolean(viewer && viewer.userId && !UNTRACKED_VIEWER_ROLES.includes(viewer.role));

// What the owner sees about someone who viewed their profile: the same fields that person's
// public profile already shows. Never e-mail, enrollment or anything from the account.
function toPublicViewer(row) {
    return {
        user_id: row.user_id,
        full_name: row.full_name || "SRMS Member",
        profile_photo: row.profile_photo,
        role: row.role,
        company: row.company,
        designation: row.designation,
        branch: row.branch,
        batch_year: row.batch_year,
        is_verified_alumni: row.role === "ALUMNI",
        views: Number(row.views),
        last_viewed_at: row.last_viewed_at,
    };
}

function toPostStats(row) {
    const impressions = Number(row.impressions);
    const likes = Number(row.likes_count);
    const comments = Number(row.comments_count);
    return {
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        media_count: Number(row.media_count),
        impressions,
        reach: Number(row.reach),
        period_impressions: Number(row.period_impressions),
        likes,
        comments,
        engagement_rate: rate(likes + comments, impressions),
    };
}

const AnalyticsService = {

    // ======================= recording (viewer always comes from the session) =======================

    // posts the client reports as shown on screen
    async recordImpressions(viewer, postIds) {
        if (!isTracked(viewer)) return { recorded: false };
        // the repository keeps only posts that are ACTIVE and belong to someone else
        const changed = await AnalyticsRepository.recordImpressions(viewer.userId, postIds);
        return { recorded: changed > 0 };
    },

    // called when a profile is opened; the owner is told once per viewer per day
    trackProfileView(viewer, profileUserId) {
        const ownerId = Number(profileUserId);
        if (!isTracked(viewer) || !ownerId || ownerId === viewer.userId) return Promise.resolve(null);

        return safely("profile view", async () => {
            const firstToday = await AnalyticsRepository.recordProfileView(ownerId, viewer.userId);
            if (firstToday) {
                await NotificationService.notifyEvent({
                    type: "PROFILE_VIEW",
                    recipientId: ownerId,
                    actorId: viewer.userId,
                    referenceId: viewer.userId,
                    dedupeKey: `PROFILE_VIEW:${viewer.userId}:${toDay(new Date())}`,
                });
            }
            return firstToday;
        });
    },

    // called with the people a search actually listed
    trackSearchAppearances(viewer, userIds) {
        const ids = [...new Set((userIds || []).map(Number))].filter((id) => id && id !== viewer?.userId);
        if (!isTracked(viewer) || !ids.length) return Promise.resolve(null);
        return safely("search appearances", () => AnalyticsRepository.recordSearchAppearances(viewer.userId, ids));
    },

    // ======================= reading (always the signed-in user's own numbers) =======================

    async getOverview(viewer, { days }) {
        const p = periods(days);
        const me = viewer.userId;

        const [posts, postsBefore, profile, profileBefore, search, searchBefore, series, searchers, profileAudience] = await Promise.all([
            AnalyticsRepository.postTotals(me, p.from, p.to),
            AnalyticsRepository.postTotals(me, p.previousFrom, p.previousTo),
            AnalyticsRepository.profileViewTotals(me, p.from, p.to),
            AnalyticsRepository.profileViewTotals(me, p.previousFrom, p.previousTo),
            AnalyticsRepository.searchTotals(me, p.from, p.to),
            AnalyticsRepository.searchTotals(me, p.previousFrom, p.previousTo),
            AnalyticsRepository.dailySeries(me, p.from, p.to),
            AnalyticsRepository.audienceBreakdown("search", me, p.from, p.to),
            AnalyticsRepository.audienceBreakdown("profile", me, p.from, p.to),
        ]);

        const engagements = posts.likes + posts.comments;
        const engagementsBefore = postsBefore.likes + postsBefore.comments;

        return {
            range: { days: p.days, from: p.from, to: p.to, previous_from: p.previousFrom, previous_to: p.previousTo },
            totals: {
                post_impressions: metric(posts.impressions, postsBefore.impressions),
                post_reach: metric(posts.reach, postsBefore.reach),
                engagements: metric(engagements, engagementsBefore),
                likes: metric(posts.likes, postsBefore.likes),
                comments: metric(posts.comments, postsBefore.comments),
                engagement_rate: rate(engagements, posts.impressions),
                profile_views: metric(profile.views, profileBefore.views),
                profile_viewers: metric(profile.viewers, profileBefore.viewers),
                search_appearances: metric(search.appearances, searchBefore.appearances),
                searchers: metric(search.searchers, searchBefore.searchers),
            },
            series: daysBetween(p.from, p.to).map((date) => ({
                date,
                post_impressions: series.impressions[date] || 0,
                profile_views: series.profileViews[date] || 0,
                search_appearances: series.searches[date] || 0,
            })),
            // who searched for / viewed you, as groups only - never as a list of names
            searchers: searchers,
            profile_audience: profileAudience,
            definitions: DEFINITIONS,
        };
    },

    async getPostStats(viewer, { days, sort, page, limit }) {
        const p = periods(days);
        const [rows, total] = await Promise.all([
            AnalyticsRepository.findPostStats(viewer.userId, p.from, p.to, { sort, limit, offset: (page - 1) * limit }),
            AnalyticsRepository.countPosts(viewer.userId),
        ]);
        return {
            range: { days: p.days, from: p.from, to: p.to },
            posts: rows.map(toPostStats),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    },

    async getProfileViewers(viewer, { days, page, limit }) {
        const p = periods(days);
        const [rows, totals] = await Promise.all([
            AnalyticsRepository.findProfileViewers(viewer.userId, p.from, p.to, { limit, offset: (page - 1) * limit }),
            AnalyticsRepository.profileViewTotals(viewer.userId, p.from, p.to),
        ]);
        return {
            range: { days: p.days, from: p.from, to: p.to },
            viewers: rows.map(toPublicViewer),
            total_views: totals.views,
            pagination: { page, limit, total: totals.viewers, totalPages: Math.max(1, Math.ceil(totals.viewers / limit)) },
        };
    },
};

module.exports = AnalyticsService;
module.exports.periods = periods;
module.exports.daysBetween = daysBetween;
module.exports.metric = metric;
module.exports.toPublicViewer = toPublicViewer;
module.exports.toPostStats = toPostStats;
