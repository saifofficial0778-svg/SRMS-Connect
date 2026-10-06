const pool = require("../../config/db");
const { ACTIVE_STATUSES } = require("./career.constants");

const ACTIVE_IN = ACTIVE_STATUSES.map((s) => `'${s}'`).join(", "); // constants, not user input

// Both people are described only by what their public profile already shows.
// Never select email, enrollment, mobile or dob here.
const REQUEST_SELECT = `
    SELECT
        cr.id, cr.type, cr.requester_id, cr.alumni_id, cr.job_id, cr.message, cr.resume_url,
        cr.response, cr.status, cr.responded_at, cr.created_at, cr.updated_at,
        rp.full_name AS requester_name, rp.profile_photo AS requester_photo,
        rp.designation AS requester_designation, rp.company AS requester_company,
        rp.branch AS requester_branch, rp.batch_year AS requester_batch_year,
        ru.role AS requester_role, ru.status AS requester_status,
        ap.full_name AS alumni_name, ap.profile_photo AS alumni_photo,
        ap.designation AS alumni_designation, ap.company AS alumni_company,
        au.role AS alumni_role, au.status AS alumni_status,
        j.title AS job_title, j.company AS job_company, j.location AS job_location, j.status AS job_status
    FROM career_requests cr
    JOIN users ru ON ru.id = cr.requester_id
    JOIN users au ON au.id = cr.alumni_id
    LEFT JOIN profiles rp ON rp.user_id = cr.requester_id
    LEFT JOIN profiles ap ON ap.user_id = cr.alumni_id
    LEFT JOIN jobs j ON j.id = cr.job_id`;

// "sent" = my requests, "received" = requests made to me. Always scoped to the viewer, and a
// request whose other party is no longer an ACTIVE account is hidden (same rule as search).
function buildListFilter(viewerId, { box, type, status }) {
    const where = [box === "received" ? "cr.alumni_id = ? AND ru.status = 'ACTIVE'" : "cr.requester_id = ? AND au.status = 'ACTIVE'"];
    const params = [viewerId];
    if (type) {
        where.push("cr.type = ?");
        params.push(type);
    }
    if (status) {
        where.push("cr.status = ?");
        params.push(status);
    }
    return { whereSql: where.join(" AND "), params };
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

const CareerRepository = {

    async findUserBrief(userId) {
        const [rows] = await pool.execute(`SELECT id, role, status FROM users WHERE id = ? LIMIT 1`, [userId]);
        return rows[0];
    },

    async hasOpenTo(userId, intent) {
        const [rows] = await pool.execute(
            `
            SELECT 1
            FROM profile_open_to po
            JOIN profiles p ON p.id = po.profile_id
            WHERE p.user_id = ? AND po.intent = ?
            LIMIT 1
            `,
            [userId, intent]
        );
        return rows.length > 0;
    },

    // The viewer's own accepted connections who are ACTIVE alumni, best matches first:
    // the job's poster, then people at the job's company, then those who said they are open to this.
    async findEligibleAlumni(viewerId, { type, intent, jobId = null, jobPosterId = null, jobCompany = null }) {
        const [rows] = await pool.execute(
            `
            SELECT
                u.id AS user_id,
                p.full_name,
                p.profile_photo,
                p.designation,
                p.company,
                (u.id <=> ?) AS is_job_poster,
                (p.company IS NOT NULL AND p.company <=> ?) AS same_company,
                EXISTS (
                    SELECT 1 FROM profile_open_to po WHERE po.profile_id = p.id AND po.intent = ?
                ) AS is_open_to,
                EXISTS (
                    SELECT 1 FROM career_requests cr
                    WHERE cr.requester_id = ? AND cr.alumni_id = u.id AND cr.type = ?
                      AND cr.job_ref = COALESCE(?, 0) AND cr.status IN (${ACTIVE_IN})
                ) AS has_active_request
            FROM connections c
            JOIN users u ON u.id = IF(c.sender_id = ?, c.receiver_id, c.sender_id)
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE c.status = 'ACCEPTED'
              AND (c.sender_id = ? OR c.receiver_id = ?)
              AND u.status = 'ACTIVE'
              AND u.role = 'ALUMNI'
            ORDER BY is_job_poster DESC, same_company DESC, is_open_to DESC, p.full_name ASC
            LIMIT 100
            `,
            [jobPosterId, jobCompany, intent, viewerId, type, jobId, viewerId, viewerId, viewerId]
        );
        return rows;
    },

    async countPendingByRequester(requesterId) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM career_requests WHERE requester_id = ? AND status = 'PENDING'`,
            [requesterId]
        );
        return rows[0].total;
    },

    // Inserts the request and its first history entry together. A duplicate active request is
    // rejected by the unique key (ER_DUP_ENTRY), which the service turns into a 409.
    async createRequest({ type, requesterId, alumniId, jobId, message, resumeUrl }) {
        return inTransaction(async (connection) => {
            const [result] = await connection.execute(
                `
                INSERT INTO career_requests (type, requester_id, alumni_id, job_id, message, resume_url)
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [type, requesterId, alumniId, jobId ?? null, message, resumeUrl ?? null]
            );
            await connection.execute(
                `INSERT INTO career_request_events (request_id, actor_id, from_status, to_status) VALUES (?, ?, NULL, 'PENDING')`,
                [result.insertId, requesterId]
            );
            return result.insertId;
        });
    },

    async findRequestById(id) {
        const [rows] = await pool.execute(`${REQUEST_SELECT} WHERE cr.id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
    async findRequests(viewerId, filters, limit, offset) {
        const { whereSql, params } = buildListFilter(viewerId, filters);
        const [rows] = await pool.execute(
            `
            ${REQUEST_SELECT}
            WHERE ${whereSql}
            ORDER BY (cr.status = 'PENDING') DESC, cr.created_at DESC, cr.id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            params
        );
        return rows;
    },

    async countRequests(viewerId, filters) {
        const { whereSql, params } = buildListFilter(viewerId, filters);
        const [rows] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM career_requests cr
            JOIN users ru ON ru.id = cr.requester_id
            JOIN users au ON au.id = cr.alumni_id
            WHERE ${whereSql}
            `,
            params
        );
        return rows[0].total;
    },

    async findEvents(requestId) {
        const [rows] = await pool.execute(
            `
            SELECT actor_id, from_status, to_status, note, created_at
            FROM career_request_events
            WHERE request_id = ?
            ORDER BY id ASC
            `,
            [requestId]
        );
        return rows;
    },

    // Compare-and-set: the row only changes if it is still in the status the caller saw, so two
    // simultaneous actions (accept + cancel, double click) can never both win. Returns true when
    // this call made the change.
    async transition({ id, from, to, actorId, response, markResponded = false }) {
        return inTransaction(async (connection) => {
            const sets = ["status = ?"];
            const params = [to];
            if (response !== undefined) {
                sets.push("response = ?");
                params.push(response);
            }
            if (markResponded) sets.push("responded_at = CURRENT_TIMESTAMP");

            const [result] = await connection.execute(
                `UPDATE career_requests SET ${sets.join(", ")} WHERE id = ? AND status = ?`,
                [...params, id, from]
            );
            if (!result.affectedRows) return false;

            await connection.execute(
                `INSERT INTO career_request_events (request_id, actor_id, from_status, to_status) VALUES (?, ?, ?, ?)`,
                [id, actorId, from, to]
            );
            return true;
        });
    },

    // A job was removed: its still-active referral requests can't go anywhere, so they are closed.
    // Returns the affected requests so the students can be told.
    async cancelActiveForJob(jobId) {
        return inTransaction(async (connection) => {
            const [rows] = await connection.execute(
                `SELECT id, requester_id, alumni_id, status FROM career_requests WHERE job_id = ? AND status IN (${ACTIVE_IN}) FOR UPDATE`,
                [jobId]
            );
            for (const row of rows) {
                await connection.execute(`UPDATE career_requests SET status = 'CANCELLED' WHERE id = ?`, [row.id]);
                await connection.execute(
                    `INSERT INTO career_request_events (request_id, actor_id, from_status, to_status, note) VALUES (?, NULL, ?, 'CANCELLED', 'Job was removed')`,
                    [row.id, row.status]
                );
            }
            return rows;
        });
    },
};

module.exports = CareerRepository;
module.exports.buildListFilter = buildListFilter;
