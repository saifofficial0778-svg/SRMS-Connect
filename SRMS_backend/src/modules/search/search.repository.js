const pool = require("../../config/db");
const { buildPeopleFilter, buildPeopleOrder, buildPostFilter } = require("./search.queryBuilder");

// Only columns that already appear on the public profile (plus role/branch/batch) are selected.
// Never add email, enrollment, mobile, dob, resume_url, interests, career_goals or account
// status here - the service additionally whitelists the response.
const SearchRepository = {

    async searchPeople(filters, limit, offset) {
        const { whereSql, params } = buildPeopleFilter(filters);
        const { orderSql, params: orderParams } = buildPeopleOrder(filters.q);

        // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
        const [rows] = await pool.execute(
            `
            SELECT
                p.id AS profile_id,
                p.user_id,
                p.full_name,
                p.profile_photo,
                p.bio,
                p.location,
                p.company,
                p.designation,
                p.experience_years,
                p.branch,
                p.batch_year,
                u.role
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE ${whereSql}
            ORDER BY ${orderSql}
            LIMIT ${limit} OFFSET ${offset}
            `,
            [...params, ...orderParams]
        );
        return rows;
    },

    async countPeople(filters) {
        const { whereSql, params } = buildPeopleFilter(filters);
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM profiles p JOIN users u ON u.id = p.user_id WHERE ${whereSql}`,
            params
        );
        return rows[0].total;
    },

    // top skills for a page of results in one query (no N+1)
    async findSkillsForProfiles(profileIds) {
        if (!profileIds.length) return {};
        const placeholders = profileIds.map(() => "?").join(",");
        const [rows] = await pool.execute(
            `SELECT profile_id, skill FROM profile_skills WHERE profile_id IN (${placeholders}) ORDER BY id ASC`,
            profileIds
        );
        const byProfile = {};
        for (const { profile_id, skill } of rows) {
            (byProfile[profile_id] ||= []).push(skill);
        }
        return byProfile;
    },

    async findOpenToForProfiles(profileIds) {
        if (!profileIds.length) return {};
        const placeholders = profileIds.map(() => "?").join(",");
        const [rows] = await pool.execute(
            `SELECT profile_id, intent FROM profile_open_to WHERE profile_id IN (${placeholders}) ORDER BY id ASC`,
            profileIds
        );
        const byProfile = {};
        for (const { profile_id, intent } of rows) {
            (byProfile[profile_id] ||= []).push(intent);
        }
        return byProfile;
    },

    async searchPosts(q, limit, offset) {
        const { whereSql, params } = buildPostFilter(q);
        const [rows] = await pool.execute(
            `
            SELECT
                po.id,
                po.user_id,
                po.content,
                po.created_at,
                p.full_name,
                p.profile_photo
            FROM posts po
            JOIN users u ON u.id = po.user_id
            JOIN profiles p ON p.user_id = po.user_id
            WHERE ${whereSql}
            ORDER BY po.created_at DESC, po.id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            params
        );
        return rows;
    },

    async countPosts(q) {
        const { whereSql, params } = buildPostFilter(q);
        const [rows] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM posts po
            JOIN users u ON u.id = po.user_id
            WHERE ${whereSql}
            `,
            params
        );
        return rows[0].total;
    },

    // values offered by the directory's filter dropdowns (only from searchable profiles)
    async getFilterOptions() {
        const base = `
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.status = 'ACTIVE' AND u.role IN ('STUDENT', 'ALUMNI')`;

        const [branches] = await pool.execute(
            `SELECT DISTINCT p.branch AS value ${base} AND p.branch IS NOT NULL AND p.branch <> '' ORDER BY p.branch ASC`
        );
        const [years] = await pool.execute(
            `SELECT DISTINCT p.batch_year AS value ${base} AND p.batch_year IS NOT NULL ORDER BY p.batch_year DESC`
        );
        return {
            branches: branches.map((r) => r.value),
            batchYears: years.map((r) => r.value),
        };
    },
};

module.exports = SearchRepository;
