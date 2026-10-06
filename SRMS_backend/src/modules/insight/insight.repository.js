const pool = require("../../config/db");
const { escapeLike } = require("../search/search.queryBuilder");

// Everything here returns counts or the viewer's own data - never another person's row.
// Only ACTIVE accounts are counted, and only jobs posted by ACTIVE alumni.

// Resolves what was typed to its canonical skill through the alias table; a spelling nobody has
// mapped stands for itself. `x` is the alias of profile_skills / job_skills in the query.
const canonical = (x) => ({
    joins: `LEFT JOIN skill_aliases sa ON sa.alias_key = ${x}.skill_key LEFT JOIN skills s ON s.id = sa.skill_id`,
    key: `COALESCE(s.slug, ${x}.skill_key)`,
    name: `COALESCE(s.name, MIN(${x}.skill))`,
    groupBy: `COALESCE(s.slug, ${x}.skill_key), s.name`,
});

const LISTED_JOB = "j.status = 'OPEN' AND u.status = 'ACTIVE' AND u.role = 'ALUMNI'";

const limitSql = (limit) => (Number.isInteger(limit) && limit > 0 ? `LIMIT ${limit}` : "");

const InsightRepository = {

    async getTotals() {
        const [rows] = await pool.execute(
            `
            SELECT
                (SELECT COUNT(*) FROM users WHERE status = 'ACTIVE' AND role = 'ALUMNI') AS alumni,
                (SELECT COUNT(DISTINCT ps.profile_id)
                   FROM profile_skills ps
                   JOIN profiles p ON p.id = ps.profile_id
                   JOIN users u ON u.id = p.user_id
                  WHERE u.status = 'ACTIVE' AND u.role = 'ALUMNI') AS alumni_with_skills,
                (SELECT COUNT(*) FROM jobs j JOIN users u ON u.id = j.poster_id WHERE ${LISTED_JOB}) AS open_jobs,
                (SELECT COUNT(DISTINCT js.job_id)
                   FROM job_skills js
                   JOIN jobs j ON j.id = js.job_id
                   JOIN users u ON u.id = j.poster_id
                  WHERE ${LISTED_JOB}) AS open_jobs_with_skills
            `
        );
        return rows[0];
    },

    // how many ACTIVE alumni list each skill (each person counted once per skill, whatever spelling)
    async alumniSkillCounts(limit) {
        const c = canonical("ps");
        const [rows] = await pool.execute(
            `
            SELECT ${c.key} AS skill_key, ${c.name} AS skill, COUNT(DISTINCT ps.profile_id) AS total
            FROM profile_skills ps
            JOIN profiles p ON p.id = ps.profile_id
            JOIN users u ON u.id = p.user_id
            ${c.joins}
            WHERE u.status = 'ACTIVE' AND u.role = 'ALUMNI'
            GROUP BY ${c.groupBy}
            ORDER BY total DESC, skill ASC
            ${limitSql(limit)}
            `
        );
        return rows;
    },

    // how many currently listed jobs ask for each skill
    async jobSkillDemand(limit) {
        const c = canonical("js");
        const [rows] = await pool.execute(
            `
            SELECT ${c.key} AS skill_key, ${c.name} AS skill, COUNT(DISTINCT js.job_id) AS total
            FROM job_skills js
            JOIN jobs j ON j.id = js.job_id
            JOIN users u ON u.id = j.poster_id
            ${c.joins}
            WHERE ${LISTED_JOB}
            GROUP BY ${c.groupBy}
            ORDER BY total DESC, skill ASC
            ${limitSql(limit)}
            `
        );
        return rows;
    },

    async topCompanies(limit) {
        const [rows] = await pool.execute(
            `
            SELECT MIN(j.company) AS company, COUNT(*) AS total
            FROM jobs j
            JOIN users u ON u.id = j.poster_id
            WHERE ${LISTED_JOB}
            GROUP BY j.company
            ORDER BY total DESC, company ASC
            ${limitSql(limit)}
            `
        );
        return rows;
    },

    // job titles exactly as posted (grouped case-insensitively by the column's collation)
    async topRoles(limit) {
        const [rows] = await pool.execute(
            `
            SELECT MIN(j.title) AS title, COUNT(*) AS total
            FROM jobs j
            JOIN users u ON u.id = j.poster_id
            WHERE ${LISTED_JOB}
            GROUP BY j.title
            ORDER BY total DESC, title ASC
            ${limitSql(limit)}
            `
        );
        return rows;
    },

    async jobTypeCounts() {
        const [rows] = await pool.execute(
            `
            SELECT j.job_type, COUNT(*) AS total
            FROM jobs j
            JOIN users u ON u.id = j.poster_id
            WHERE ${LISTED_JOB}
            GROUP BY j.job_type
            ORDER BY total DESC
            `
        );
        return rows;
    },

    // Skills in jobs posted during the last `days` days, next to the `days` before that.
    // Closed jobs count too (they were demand when posted); deleted ones do not.
    async skillPostingTrend(days, limit) {
        const c = canonical("js");
        const [rows] = await pool.execute(
            `
            SELECT
                ${c.key} AS skill_key,
                ${c.name} AS skill,
                COUNT(DISTINCT CASE WHEN j.created_at >= NOW() - INTERVAL ${days} DAY THEN js.job_id END) AS recent,
                COUNT(DISTINCT CASE WHEN j.created_at < NOW() - INTERVAL ${days} DAY THEN js.job_id END) AS previous
            FROM job_skills js
            JOIN jobs j ON j.id = js.job_id
            JOIN users u ON u.id = j.poster_id
            ${c.joins}
            WHERE j.status <> 'DELETED'
              AND u.status = 'ACTIVE' AND u.role = 'ALUMNI'
              AND j.created_at >= NOW() - INTERVAL ${days * 2} DAY
            GROUP BY ${c.groupBy}
            HAVING recent > 0
            ORDER BY recent DESC, (recent - previous) DESC, skill ASC
            ${limitSql(limit)}
            `
        );
        return rows;
    },

    // the signed-in user's own skills, resolved to canonical skills
    async viewerSkills(userId) {
        const [rows] = await pool.execute(
            `
            SELECT COALESCE(s.slug, ps.skill_key) AS skill_key, COALESCE(s.name, ps.skill) AS skill
            FROM profile_skills ps
            JOIN profiles p ON p.id = ps.profile_id
            LEFT JOIN skill_aliases sa ON sa.alias_key = ps.skill_key
            LEFT JOIN skills s ON s.id = sa.skill_id
            WHERE p.user_id = ?
            ORDER BY ps.id ASC
            `,
            [userId]
        );
        return rows;
    },

    // currently listed jobs matching the optional filters (newest first, bounded)
    async findListedJobs({ jobType, role }, maxJobs) {
        const where = [LISTED_JOB];
        const params = [];
        if (jobType) {
            where.push("j.job_type = ?");
            params.push(jobType);
        }
        if (role) {
            where.push("j.title LIKE ?");
            params.push(`%${escapeLike(role)}%`);
        }
        const [rows] = await pool.execute(
            `
            SELECT j.id, j.title, j.company, j.job_type
            FROM jobs j
            JOIN users u ON u.id = j.poster_id
            WHERE ${where.join(" AND ")}
            ORDER BY j.created_at DESC, j.id DESC
            LIMIT ${maxJobs}
            `,
            params
        );
        return rows;
    },

    // the canonical skills each of those jobs asks for
    async findSkillsForJobs(jobIds) {
        if (!jobIds.length) return [];
        const placeholders = jobIds.map(() => "?").join(",");
        const [rows] = await pool.execute(
            `
            SELECT js.job_id, COALESCE(s.slug, js.skill_key) AS skill_key, COALESCE(s.name, js.skill) AS skill
            FROM job_skills js
            LEFT JOIN skill_aliases sa ON sa.alias_key = js.skill_key
            LEFT JOIN skills s ON s.id = sa.skill_id
            WHERE js.job_id IN (${placeholders})
            ORDER BY js.id ASC
            `,
            jobIds
        );
        return rows;
    },
};

module.exports = InsightRepository;
