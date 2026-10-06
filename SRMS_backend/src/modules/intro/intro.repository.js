const pool = require("../../config/db");

// People are described only by what their public profile already shows.
// Never select email, enrollment, mobile or dob here.
const person = (alias, prefix) => `
    ${alias}p.full_name AS ${prefix}_name, ${alias}p.profile_photo AS ${prefix}_photo,
    ${alias}p.designation AS ${prefix}_designation, ${alias}p.company AS ${prefix}_company,
    ${alias}u.role AS ${prefix}_role, ${alias}u.status AS ${prefix}_status`;

const INTRO_SELECT = `
    SELECT
        wi.id, wi.requester_id, wi.target_id, wi.introducer_id, wi.message, wi.introducer_note,
        wi.status, wi.responded_at, wi.created_at, wi.updated_at,
        ${person("r", "requester")},
        rp.branch AS requester_branch, rp.batch_year AS requester_batch_year,
        ${person("t", "target")},
        ${person("i", "introducer")}
    FROM warm_intros wi
    JOIN users ru ON ru.id = wi.requester_id
    JOIN users tu ON tu.id = wi.target_id
    JOIN users iu ON iu.id = wi.introducer_id
    LEFT JOIN profiles rp ON rp.user_id = wi.requester_id
    LEFT JOIN profiles tp ON tp.user_id = wi.target_id
    LEFT JOIN profiles ip ON ip.user_id = wi.introducer_id`;

// Which introductions a person may list:
//   sent          the ones they asked for
//   to_introduce  the ones they were asked to make
//   received      introductions made *to* them - only once the introducer has actually made them,
//                 so a target never learns about a request that was declined or is still pending
function buildIntroFilter(viewerId, box) {
    if (box === "to_introduce") return { whereSql: "wi.introducer_id = ? AND ru.status = 'ACTIVE'", params: [viewerId] };
    if (box === "received") return { whereSql: "wi.target_id = ? AND wi.status = 'INTRODUCED' AND ru.status = 'ACTIVE'", params: [viewerId] };
    return { whereSql: "wi.requester_id = ?", params: [viewerId] };
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

const ACCEPTED_WITH = (other) => `
    EXISTS (
        SELECT 1 FROM connections c
        WHERE c.status = 'ACCEPTED'
          AND ((c.sender_id = u.id AND c.receiver_id = ${other}) OR (c.receiver_id = u.id AND c.sender_id = ${other}))
    )`;

const IntroRepository = {

    async findUserBrief(userId) {
        const [rows] = await pool.execute(
            `
            SELECT u.id, u.role, u.status, p.full_name, p.profile_photo, p.designation, p.company
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = ?
            LIMIT 1
            `,
            [userId]
        );
        return rows[0];
    },

    // ACTIVE alumni who have an ACCEPTED connection with BOTH the requester and the target
    async findMutualAlumni(requesterId, targetId) {
        const [rows] = await pool.execute(
            `
            SELECT u.id AS user_id, p.full_name, p.profile_photo, p.designation, p.company
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.status = 'ACTIVE' AND u.role = 'ALUMNI'
              AND u.id NOT IN (?, ?)
              AND ${ACCEPTED_WITH("?")}
              AND ${ACCEPTED_WITH("?")}
            ORDER BY p.full_name ASC, u.id ASC
            LIMIT 50
            `,
            [requesterId, targetId, requesterId, requesterId, targetId, targetId]
        );
        return rows;
    },

    // the requester's unresolved or already-made introduction to this person, if any
    async findOpenIntro(requesterId, targetId) {
        const [rows] = await pool.execute(
            `
            SELECT id, status, introducer_id
            FROM warm_intros
            WHERE requester_id = ? AND target_id = ? AND status IN ('PENDING', 'INTRODUCED')
            ORDER BY id DESC
            LIMIT 1
            `,
            [requesterId, targetId]
        );
        return rows[0];
    },

    async countPendingByRequester(requesterId) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM warm_intros WHERE requester_id = ? AND status = 'PENDING'`,
            [requesterId]
        );
        return rows[0].total;
    },

    // a second pending request for the same target is rejected by the unique key (ER_DUP_ENTRY)
    async createIntro({ requesterId, targetId, introducerId, message }) {
        const [result] = await pool.execute(
            `INSERT INTO warm_intros (requester_id, target_id, introducer_id, message) VALUES (?, ?, ?, ?)`,
            [requesterId, targetId, introducerId, message]
        );
        return result.insertId;
    },

    async findIntroById(id) {
        const [rows] = await pool.execute(`${INTRO_SELECT} WHERE wi.id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
    async findIntros(viewerId, box, limit, offset) {
        const { whereSql, params } = buildIntroFilter(viewerId, box);
        const [rows] = await pool.execute(
            `
            ${INTRO_SELECT}
            WHERE ${whereSql}
            ORDER BY (wi.status = 'PENDING') DESC, wi.created_at DESC, wi.id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            params
        );
        return rows;
    },

    async countIntros(viewerId, box) {
        const { whereSql, params } = buildIntroFilter(viewerId, box);
        const [rows] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM warm_intros wi
            JOIN users ru ON ru.id = wi.requester_id
            WHERE ${whereSql}
            `,
            params
        );
        return rows[0].total;
    },

    // compare-and-set: only a still-PENDING request can be resolved, so two actions can't both win
    async resolve({ id, to, note }) {
        return inTransaction(async (connection) => {
            const sets = ["status = ?", "responded_at = CURRENT_TIMESTAMP"];
            const params = [to];
            if (note !== undefined) {
                sets.push("introducer_note = ?");
                params.push(note);
            }
            const [result] = await connection.execute(
                `UPDATE warm_intros SET ${sets.join(", ")} WHERE id = ? AND status = 'PENDING'`,
                [...params, id]
            );
            return result.affectedRows > 0;
        });
    },
};

module.exports = IntroRepository;
module.exports.buildIntroFilter = buildIntroFilter;
