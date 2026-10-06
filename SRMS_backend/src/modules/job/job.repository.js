const pool = require("../../config/db");
const { buildJobFilter } = require("./job.queryBuilder");

// Poster details are limited to what their public profile already shows. Never select
// email, enrollment, mobile or dob here.
const JOB_COLUMNS = `
    j.id,
    j.poster_id,
    j.title,
    j.company,
    j.location,
    j.job_type,
    j.experience_min,
    j.experience_max,
    j.status,
    j.created_at,
    j.updated_at,
    p.full_name AS poster_name,
    p.profile_photo AS poster_photo,
    p.designation AS poster_designation,
    p.company AS poster_company,
    u.role AS poster_role,
    u.status AS poster_status`;

// LEFT JOIN on profiles: a few older accounts have no profile row, and their jobs must not vanish
const POSTER_JOINS = `
    JOIN users u ON u.id = j.poster_id
    LEFT JOIN profiles p ON p.user_id = j.poster_id`;

// only these columns can ever be written by an update (keys come from validated input, but
// the whitelist keeps column names out of reach of anything else)
const UPDATABLE = ["title", "company", "location", "job_type", "experience_min", "experience_max", "description", "apply_url"];

async function replaceSkills(connection, jobId, skills) {
    await connection.execute(`DELETE FROM job_skills WHERE job_id = ?`, [jobId]);
    for (const skill of skills) {
        await connection.execute(`INSERT INTO job_skills (job_id, skill) VALUES (?, ?)`, [jobId, skill]);
    }
}

async function inTransaction(work) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

const JobRepository = {

    // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
    async findJobs(filters, limit, offset) {
        const { whereSql, params } = buildJobFilter(filters);
        const [rows] = await pool.execute(
            `
            SELECT ${JOB_COLUMNS}, LEFT(j.description, 220) AS description_preview
            FROM jobs j ${POSTER_JOINS}
            WHERE ${whereSql}
            ORDER BY j.created_at DESC, j.id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            params
        );
        return rows;
    },

    async countJobs(filters) {
        const { whereSql, params } = buildJobFilter(filters);
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM jobs j ${POSTER_JOINS} WHERE ${whereSql}`,
            params
        );
        return rows[0].total;
    },

    // required skills for a page of jobs in one query (no N+1)
    async findSkillsForJobs(jobIds) {
        if (!jobIds.length) return {};
        const placeholders = jobIds.map(() => "?").join(",");
        const [rows] = await pool.execute(
            `SELECT job_id, skill FROM job_skills WHERE job_id IN (${placeholders}) ORDER BY id ASC`,
            jobIds
        );
        const byJob = {};
        for (const { job_id, skill } of rows) {
            (byJob[job_id] ||= []).push(skill);
        }
        return byJob;
    },

    // full row incl. description and application link; visibility is decided by the service
    async findJobById(id) {
        const [rows] = await pool.execute(
            `
            SELECT ${JOB_COLUMNS}, j.description, j.apply_url
            FROM jobs j ${POSTER_JOINS}
            WHERE j.id = ?
            LIMIT 1
            `,
            [id]
        );
        return rows[0];
    },

    async countOpenByPoster(posterId) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM jobs WHERE poster_id = ? AND status = 'OPEN'`,
            [posterId]
        );
        return rows[0].total;
    },

    async createJob(posterId, data) {
        return inTransaction(async (connection) => {
            const [result] = await connection.execute(
                `
                INSERT INTO jobs
                    (poster_id, title, company, location, job_type, experience_min, experience_max, description, apply_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    posterId,
                    data.title,
                    data.company,
                    data.location,
                    data.job_type,
                    data.experience_min,
                    data.experience_max ?? null,
                    data.description,
                    data.apply_url,
                ]
            );
            await replaceSkills(connection, result.insertId, data.skills || []);
            return result.insertId;
        });
    },

    async updateJob(id, data) {
        return inTransaction(async (connection) => {
            const columns = UPDATABLE.filter((key) => data[key] !== undefined);
            if (columns.length) {
                await connection.execute(
                    `UPDATE jobs SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND status <> 'DELETED'`,
                    [...columns.map((c) => data[c]), id]
                );
            }
            if (data.skills !== undefined) {
                await replaceSkills(connection, id, data.skills);
            }
        });
    },

    async setStatus(id, status) {
        const [result] = await pool.execute(
            `UPDATE jobs SET status = ? WHERE id = ? AND status <> 'DELETED'`,
            [status, id]
        );
        return result.affectedRows;
    },

    // soft delete, same approach as posts
    async softDelete(id) {
        const [result] = await pool.execute(
            `UPDATE jobs SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'DELETED'`,
            [id]
        );
        return result.affectedRows;
    },
};

module.exports = JobRepository;
