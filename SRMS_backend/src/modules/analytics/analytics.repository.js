const pool = require("../../config/db");
const { CAPS, TOP_LIMIT } = require("./analytics.constants");

const placeholders = (list) => list.map(() => "?").join(", ");

// only people who are still ACTIVE members count as an audience
const ACTIVE_VIEWER = "JOIN users vu ON vu.id = v.viewer_id AND vu.status = 'ACTIVE'";

const AnalyticsRepository = {

    // ======================= recording =======================

    // One row per post + viewer + day. The SELECT is what enforces the rules: only posts that exist,
    // are still ACTIVE and belong to someone else can be recorded, whatever ids the client sent.
    async recordImpressions(viewerId, postIds) {
        if (!postIds.length) return 0;
        const [result] = await pool.query(
            `
            INSERT INTO post_impressions (post_id, viewer_id, view_date, views)
            SELECT p.id, ?, CURDATE(), 1
            FROM posts p
            WHERE p.id IN (${placeholders(postIds)})
              AND p.status = 'ACTIVE'
              AND p.user_id <> ?
            ON DUPLICATE KEY UPDATE views = LEAST(views + 1, ${CAPS.POST_VIEWS_PER_DAY})
            `,
            [viewerId, ...postIds, viewerId]
        );
        return result.affectedRows;
    },

    // returns true only for the first view of the day by this viewer (a new row)
    async recordProfileView(profileUserId, viewerId) {
        const [result] = await pool.execute(
            `
            INSERT INTO profile_views (profile_user_id, viewer_id, view_date, views)
            VALUES (?, ?, CURDATE(), 1)
            ON DUPLICATE KEY UPDATE
                views = LEAST(views + 1, ${CAPS.PROFILE_VIEWS_PER_DAY}),
                last_viewed_at = CURRENT_TIMESTAMP
            `,
            [profileUserId, viewerId]
        );
        return result.affectedRows === 1; // 1 = inserted, 2 = updated
    },

    async recordSearchAppearances(viewerId, userIds) {
        if (!userIds.length) return 0;
        const [result] = await pool.query(
            `
            INSERT INTO search_appearances (user_id, viewer_id, appeared_date, appearances)
            SELECT u.id, ?, CURDATE(), 1
            FROM users u
            WHERE u.id IN (${placeholders(userIds)})
              AND u.status = 'ACTIVE'
              AND u.id <> ?
            ON DUPLICATE KEY UPDATE appearances = LEAST(appearances + 1, ${CAPS.SEARCH_APPEARANCES_PER_DAY})
            `,
            [viewerId, ...userIds, viewerId]
        );
        return result.affectedRows;
    },

    // ======================= totals for a period (dates inclusive, 'YYYY-MM-DD') =======================

    async postTotals(userId, from, to) {
        const [[views]] = await pool.execute(
            `
            SELECT COALESCE(SUM(v.views), 0) AS impressions, COUNT(DISTINCT v.viewer_id) AS reach
            FROM post_impressions v
            JOIN posts p ON p.id = v.post_id AND p.user_id = ?
            ${ACTIVE_VIEWER}
            WHERE v.view_date BETWEEN ? AND ?
            `,
            [userId, from, to]
        );
        // likes and comments by other people, on the day they happened
        const [[likes]] = await pool.execute(
            `
            SELECT COUNT(*) AS c
            FROM post_likes pl
            JOIN posts p ON p.id = pl.post_id AND p.user_id = ?
            WHERE pl.user_id <> ? AND DATE(pl.created_at) BETWEEN ? AND ?
            `,
            [userId, userId, from, to]
        );
        const [[comments]] = await pool.execute(
            `
            SELECT COUNT(*) AS c
            FROM post_comments pc
            JOIN posts p ON p.id = pc.post_id AND p.user_id = ?
            WHERE pc.user_id <> ? AND DATE(pc.created_at) BETWEEN ? AND ?
            `,
            [userId, userId, from, to]
        );
        return {
            impressions: Number(views.impressions),
            reach: Number(views.reach),
            likes: Number(likes.c),
            comments: Number(comments.c),
        };
    },

    async profileViewTotals(userId, from, to) {
        const [[row]] = await pool.execute(
            `
            SELECT COALESCE(SUM(v.views), 0) AS views, COUNT(DISTINCT v.viewer_id) AS viewers
            FROM profile_views v
            ${ACTIVE_VIEWER}
            WHERE v.profile_user_id = ? AND v.view_date BETWEEN ? AND ?
            `,
            [userId, from, to]
        );
        return { views: Number(row.views), viewers: Number(row.viewers) };
    },

    async searchTotals(userId, from, to) {
        const [[row]] = await pool.execute(
            `
            SELECT COALESCE(SUM(v.appearances), 0) AS appearances, COUNT(DISTINCT v.viewer_id) AS searchers
            FROM search_appearances v
            ${ACTIVE_VIEWER}
            WHERE v.user_id = ? AND v.appeared_date BETWEEN ? AND ?
            `,
            [userId, from, to]
        );
        return { appearances: Number(row.appearances), searchers: Number(row.searchers) };
    },

    // ======================= one number per day, for the chart =======================

    async dailySeries(userId, from, to) {
        const [impressions] = await pool.execute(
            `
            SELECT DATE_FORMAT(v.view_date, '%Y-%m-%d') AS day, SUM(v.views) AS value
            FROM post_impressions v
            JOIN posts p ON p.id = v.post_id AND p.user_id = ?
            ${ACTIVE_VIEWER}
            WHERE v.view_date BETWEEN ? AND ?
            GROUP BY v.view_date
            `,
            [userId, from, to]
        );
        const [profileViews] = await pool.execute(
            `
            SELECT DATE_FORMAT(v.view_date, '%Y-%m-%d') AS day, SUM(v.views) AS value
            FROM profile_views v
            ${ACTIVE_VIEWER}
            WHERE v.profile_user_id = ? AND v.view_date BETWEEN ? AND ?
            GROUP BY v.view_date
            `,
            [userId, from, to]
        );
        const [searches] = await pool.execute(
            `
            SELECT DATE_FORMAT(v.appeared_date, '%Y-%m-%d') AS day, SUM(v.appearances) AS value
            FROM search_appearances v
            ${ACTIVE_VIEWER}
            WHERE v.user_id = ? AND v.appeared_date BETWEEN ? AND ?
            GROUP BY v.appeared_date
            `,
            [userId, from, to]
        );
        const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.day, Number(r.value)]));
        return { impressions: toMap(impressions), profileViews: toMap(profileViews), searches: toMap(searches) };
    },

    // ======================= who the audience is (aggregated: never a name) =======================

    // table/column names come from the fixed map below, never from a request
    async audienceBreakdown(kind, userId, from, to) {
        const source = {
            search: { table: "search_appearances", owner: "user_id", date: "appeared_date" },
            profile: { table: "profile_views", owner: "profile_user_id", date: "view_date" },
        }[kind];
        const base = `
            FROM ${source.table} v
            ${ACTIVE_VIEWER}
            LEFT JOIN profiles vp ON vp.user_id = v.viewer_id
            WHERE v.${source.owner} = ? AND v.${source.date} BETWEEN ? AND ?`;
        const params = [userId, from, to];

        const [roles] = await pool.execute(
            `SELECT vu.role AS label, COUNT(DISTINCT v.viewer_id) AS people ${base} GROUP BY vu.role ORDER BY people DESC`,
            params
        );
        const [companies] = await pool.execute(
            `SELECT vp.company AS label, COUNT(DISTINCT v.viewer_id) AS people ${base}
             AND vu.role = 'ALUMNI' AND vp.company IS NOT NULL AND vp.company <> ''
             GROUP BY vp.company ORDER BY people DESC, vp.company ASC LIMIT ${TOP_LIMIT}`,
            params
        );
        const [designations] = await pool.execute(
            `SELECT vp.designation AS label, COUNT(DISTINCT v.viewer_id) AS people ${base}
             AND vu.role = 'ALUMNI' AND vp.designation IS NOT NULL AND vp.designation <> ''
             GROUP BY vp.designation ORDER BY people DESC, vp.designation ASC LIMIT ${TOP_LIMIT}`,
            params
        );
        const clean = (rows) => rows.map((r) => ({ label: r.label, people: Number(r.people) }));
        return { roles: clean(roles), companies: clean(companies), designations: clean(designations) };
    },

    // ======================= my posts, with their numbers =======================

    // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
    async findPostStats(userId, from, to, { sort, limit, offset }) {
        const orderBy = sort === "impressions" ? "impressions DESC, p.created_at DESC" : "p.created_at DESC, p.id DESC";
        const [rows] = await pool.execute(
            `
            SELECT
                p.id,
                p.content,
                p.created_at,
                (SELECT COUNT(*) FROM post_media pm WHERE pm.post_id = p.id) AS media_count,
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
                (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
                COALESCE(s.impressions, 0) AS impressions,
                COALESCE(s.reach, 0) AS reach,
                COALESCE(s.period_impressions, 0) AS period_impressions
            FROM posts p
            LEFT JOIN (
                SELECT v.post_id,
                       SUM(v.views) AS impressions,
                       COUNT(DISTINCT v.viewer_id) AS reach,
                       SUM(IF(v.view_date BETWEEN ? AND ?, v.views, 0)) AS period_impressions
                FROM post_impressions v
                ${ACTIVE_VIEWER}
                GROUP BY v.post_id
            ) s ON s.post_id = p.id
            WHERE p.user_id = ? AND p.status = 'ACTIVE' AND p.deleted_at IS NULL
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
            `,
            [from, to, userId]
        );
        return rows;
    },

    async countPosts(userId) {
        const [[row]] = await pool.execute(
            "SELECT COUNT(*) AS c FROM posts WHERE user_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL",
            [userId]
        );
        return Number(row.c);
    },

    // impressions + reach for a set of posts (used to decorate the owner's own post list)
    async findImpressionsForPosts(postIds) {
        if (!postIds.length) return {};
        const [rows] = await pool.query(
            `
            SELECT v.post_id, SUM(v.views) AS impressions, COUNT(DISTINCT v.viewer_id) AS reach
            FROM post_impressions v
            ${ACTIVE_VIEWER}
            WHERE v.post_id IN (${placeholders(postIds)})
            GROUP BY v.post_id
            `,
            postIds
        );
        return Object.fromEntries(rows.map((r) => [r.post_id, { impressions: Number(r.impressions), reach: Number(r.reach) }]));
    },

    // ======================= who viewed my profile =======================

    async findProfileViewers(userId, from, to, { limit, offset }) {
        const [rows] = await pool.execute(
            `
            SELECT
                v.viewer_id AS user_id,
                vu.role,
                vp.full_name,
                vp.profile_photo,
                vp.company,
                vp.designation,
                vp.branch,
                vp.batch_year,
                SUM(v.views) AS views,
                MAX(v.last_viewed_at) AS last_viewed_at
            FROM profile_views v
            ${ACTIVE_VIEWER}
            LEFT JOIN profiles vp ON vp.user_id = v.viewer_id
            WHERE v.profile_user_id = ? AND v.view_date BETWEEN ? AND ?
            GROUP BY v.viewer_id, vu.role, vp.full_name, vp.profile_photo, vp.company, vp.designation, vp.branch, vp.batch_year
            ORDER BY last_viewed_at DESC, v.viewer_id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            [userId, from, to]
        );
        return rows;
    },
};

module.exports = AnalyticsRepository;
