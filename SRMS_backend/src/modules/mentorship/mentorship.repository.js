const pool = require("../../config/db");
const { escapeLike, splitTerms } = require("../search/search.queryBuilder");

// People are described only by what their public profile already shows.
// Never select email, enrollment, mobile or dob here.

// A mentor is listed only while they are an ACTIVE alumnus who is accepting requests.
const LISTED_MENTOR = "u.status = 'ACTIVE' AND u.role = 'ALUMNI' AND mp.is_accepting = 1";

const MENTOR_SELECT = `
    SELECT
        mp.user_id, mp.bio, mp.availability, mp.max_active_mentees, mp.is_accepting,
        p.id AS profile_id, p.full_name, p.profile_photo, p.designation, p.company, p.branch, p.batch_year,
        u.role, u.status,
        (SELECT COUNT(*) FROM mentorships m WHERE m.mentor_id = mp.user_id AND m.status = 'ACTIVE') AS active_mentees
    FROM mentor_profiles mp
    JOIN users u ON u.id = mp.user_id
    LEFT JOIN profiles p ON p.user_id = mp.user_id`;

const MENTORSHIP_SELECT = `
    SELECT
        m.id, m.mentor_id, m.mentee_id, m.topic, m.message, m.response, m.closing_note, m.status,
        m.started_at, m.ended_at, m.created_at, m.updated_at,
        mrp.full_name AS mentor_name, mrp.profile_photo AS mentor_photo,
        mrp.designation AS mentor_designation, mrp.company AS mentor_company,
        mru.status AS mentor_status, mru.role AS mentor_role,
        mep.full_name AS mentee_name, mep.profile_photo AS mentee_photo,
        mep.branch AS mentee_branch, mep.batch_year AS mentee_batch_year,
        meu.status AS mentee_status, meu.role AS mentee_role
    FROM mentorships m
    JOIN users mru ON mru.id = m.mentor_id
    JOIN users meu ON meu.id = m.mentee_id
    LEFT JOIN profiles mrp ON mrp.user_id = m.mentor_id
    LEFT JOIN profiles mep ON mep.user_id = m.mentee_id`;

function buildMentorFilter({ excludeUserId, q, topic, skillKeyGroups }) {
    const where = [LISTED_MENTOR];
    const params = [];

    if (excludeUserId) {
        where.push("mp.user_id <> ?");
        params.push(excludeUserId);
    }
    // every word must appear in the name, company, designation or mentor bio
    for (const term of splitTerms(q)) {
        const contains = `%${escapeLike(term)}%`;
        where.push("(p.full_name LIKE ? OR p.company LIKE ? OR p.designation LIKE ? OR mp.bio LIKE ?)");
        params.push(contains, contains, contains, contains);
    }
    if (topic) {
        where.push("EXISTS (SELECT 1 FROM mentor_tags mt WHERE mt.mentor_id = mp.user_id AND mt.kind = 'TOPIC' AND mt.value = ?)");
        params.push(topic);
    }
    // each requested skill is a group of spelling keys meaning the same skill (see SkillService)
    for (const keys of skillKeyGroups || []) {
        where.push(
            `EXISTS (SELECT 1 FROM profile_skills ps WHERE ps.profile_id = p.id AND ps.skill_key IN (${keys.map(() => "?").join(", ")}))`
        );
        params.push(...keys);
    }
    return { whereSql: where.join(" AND "), params };
}

// mentee = mentorships where I am the student, mentor = where I am the mentor. Always bound to the
// viewer, and hidden when the other person is no longer an ACTIVE account.
function buildMentorshipFilter(viewerId, { box, status }) {
    const where = [box === "mentor" ? "m.mentor_id = ? AND meu.status = 'ACTIVE'" : "m.mentee_id = ? AND mru.status = 'ACTIVE'"];
    const params = [viewerId];
    if (status) {
        where.push("m.status = ?");
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

const placeholders = (list) => list.map(() => "?").join(",");

const MentorshipRepository = {

    // ---------- mentor profiles ----------

    async findUserBrief(userId) {
        const [rows] = await pool.execute(`SELECT id, role, status FROM users WHERE id = ? LIMIT 1`, [userId]);
        return rows[0];
    },

    // any mentor profile of this user, listed or not (used for their own page and for requests)
    async findMentorByUserId(userId) {
        const [rows] = await pool.execute(`${MENTOR_SELECT} WHERE mp.user_id = ? LIMIT 1`, [userId]);
        return rows[0];
    },

    // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
    async findMentors(filters, limit, offset) {
        const { whereSql, params } = buildMentorFilter(filters);
        const [rows] = await pool.execute(
            `
            ${MENTOR_SELECT}
            WHERE ${whereSql}
            ORDER BY p.full_name ASC, mp.user_id ASC
            LIMIT ${limit} OFFSET ${offset}
            `,
            params
        );
        return rows;
    },

    async countMentors(filters) {
        const { whereSql, params } = buildMentorFilter(filters);
        const [rows] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM mentor_profiles mp
            JOIN users u ON u.id = mp.user_id
            LEFT JOIN profiles p ON p.user_id = mp.user_id
            WHERE ${whereSql}
            `,
            params
        );
        return rows[0].total;
    },

    // topics and preferred areas for a page of mentors in one query
    async findTagsForMentors(userIds) {
        if (!userIds.length) return {};
        const [rows] = await pool.execute(
            `SELECT mentor_id, kind, value FROM mentor_tags WHERE mentor_id IN (${placeholders(userIds)}) ORDER BY id ASC`,
            userIds
        );
        const byMentor = {};
        for (const { mentor_id: id, kind, value } of rows) {
            const entry = (byMentor[id] ||= { topics: [], areas: [] });
            (kind === "TOPIC" ? entry.topics : entry.areas).push(value);
        }
        return byMentor;
    },

    // a mentor's expertise is their existing profile skills, resolved to canonical skills
    async findSkillsForProfiles(profileIds) {
        if (!profileIds.length) return {};
        const [rows] = await pool.execute(
            `
            SELECT ps.profile_id, COALESCE(s.slug, ps.skill_key) AS skill_key, COALESCE(s.name, ps.skill) AS skill
            FROM profile_skills ps
            LEFT JOIN skill_aliases sa ON sa.alias_key = ps.skill_key
            LEFT JOIN skills s ON s.id = sa.skill_id
            WHERE ps.profile_id IN (${placeholders(profileIds)})
            ORDER BY ps.id ASC
            `,
            profileIds
        );
        const byProfile = {};
        for (const { profile_id: id, skill_key: key, skill: name } of rows) {
            const list = (byProfile[id] ||= []);
            if (!list.some((s) => s.key === key)) list.push({ key, name });
        }
        return byProfile;
    },

    // which of these users say "Open to: Mentorship" on their profile
    async findOpenToMentorship(userIds) {
        if (!userIds.length) return new Set();
        const [rows] = await pool.execute(
            `
            SELECT p.user_id
            FROM profile_open_to po
            JOIN profiles p ON p.id = po.profile_id
            WHERE po.intent = 'MENTORSHIP' AND p.user_id IN (${placeholders(userIds)})
            `,
            userIds
        );
        return new Set(rows.map((r) => r.user_id));
    },

    // ids of everyone the viewer has an ACCEPTED connection with
    async findConnectedUserIds(viewerId) {
        const [rows] = await pool.execute(
            `
            SELECT IF(c.sender_id = ?, c.receiver_id, c.sender_id) AS other_id
            FROM connections c
            WHERE c.status = 'ACCEPTED' AND (c.sender_id = ? OR c.receiver_id = ?)
            `,
            [viewerId, viewerId, viewerId]
        );
        return new Set(rows.map((r) => r.other_id));
    },

    async findViewerBranch(userId) {
        const [rows] = await pool.execute(`SELECT branch FROM profiles WHERE user_id = ? LIMIT 1`, [userId]);
        return rows[0]?.branch || null;
    },

    // Creates or updates the mentor profile and replaces its topics/areas in one transaction.
    // Becoming a mentor also sets "Open to: Mentorship" on the public profile (never removes it).
    async upsertMentorProfile(userId, { bio, availability, maxActiveMentees, isAccepting, topics, areas }) {
        return inTransaction(async (connection) => {
            await connection.execute(
                `
                INSERT INTO mentor_profiles (user_id, bio, availability, max_active_mentees, is_accepting)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    bio = VALUES(bio),
                    availability = VALUES(availability),
                    max_active_mentees = VALUES(max_active_mentees),
                    is_accepting = VALUES(is_accepting)
                `,
                [userId, bio, availability, maxActiveMentees, isAccepting ? 1 : 0]
            );
            await connection.execute(`DELETE FROM mentor_tags WHERE mentor_id = ?`, [userId]);
            for (const topic of topics) {
                await connection.execute(`INSERT INTO mentor_tags (mentor_id, kind, value) VALUES (?, 'TOPIC', ?)`, [userId, topic]);
            }
            for (const area of areas) {
                await connection.execute(`INSERT INTO mentor_tags (mentor_id, kind, value) VALUES (?, 'AREA', ?)`, [userId, area]);
            }
            await connection.execute(
                `INSERT IGNORE INTO profile_open_to (profile_id, intent) SELECT id, 'MENTORSHIP' FROM profiles WHERE user_id = ?`,
                [userId]
            );
        });
    },

    // ---------- mentorships ----------

    async countPendingByMentee(menteeId) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM mentorships WHERE mentee_id = ? AND status = 'PENDING'`,
            [menteeId]
        );
        return rows[0].total;
    },

    // Inserts the request, its first history entry and any starting goals together. A second open
    // mentorship with the same mentor is rejected by the unique key (ER_DUP_ENTRY -> 409).
    async createMentorship({ mentorId, menteeId, topic, message, goals }) {
        return inTransaction(async (connection) => {
            const [result] = await connection.execute(
                `INSERT INTO mentorships (mentor_id, mentee_id, topic, message) VALUES (?, ?, ?, ?)`,
                [mentorId, menteeId, topic, message]
            );
            const id = result.insertId;
            await connection.execute(
                `INSERT INTO mentorship_events (mentorship_id, actor_id, from_status, to_status) VALUES (?, ?, NULL, 'PENDING')`,
                [id, menteeId]
            );
            for (const title of goals || []) {
                await connection.execute(
                    `INSERT INTO mentorship_goals (mentorship_id, title, created_by) VALUES (?, ?, ?)`,
                    [id, title, menteeId]
                );
            }
            return id;
        });
    },

    async findMentorshipById(id) {
        const [rows] = await pool.execute(`${MENTORSHIP_SELECT} WHERE m.id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    async findMentorships(viewerId, filters, limit, offset) {
        const { whereSql, params } = buildMentorshipFilter(viewerId, filters);
        const [rows] = await pool.execute(
            `
            ${MENTORSHIP_SELECT}
            WHERE ${whereSql}
            ORDER BY FIELD(m.status, 'PENDING', 'ACTIVE') = 0, m.updated_at DESC, m.id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            params
        );
        return rows;
    },

    async countMentorships(viewerId, filters) {
        const { whereSql, params } = buildMentorshipFilter(viewerId, filters);
        const [rows] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM mentorships m
            JOIN users mru ON mru.id = m.mentor_id
            JOIN users meu ON meu.id = m.mentee_id
            WHERE ${whereSql}
            `,
            params
        );
        return rows[0].total;
    },

    // the viewer's open (PENDING/ACTIVE) mentorship with this mentor, if any
    async findOpenBetween(mentorId, menteeId) {
        const [rows] = await pool.execute(
            `SELECT id, status FROM mentorships WHERE mentor_id = ? AND mentee_id = ? AND status IN ('PENDING', 'ACTIVE') LIMIT 1`,
            [mentorId, menteeId]
        );
        return rows[0];
    },

    // Accepting is the one change that must respect the mentor's capacity, so it locks the mentor
    // profile row first: two accepts at the same moment can't both squeeze past the limit.
    // -> "accepted" | "full" | "stale" (someone already changed the request)
    async acceptMentorship({ id, mentorId, response }) {
        return inTransaction(async (connection) => {
            const [[mentor]] = await connection.execute(
                `SELECT max_active_mentees FROM mentor_profiles WHERE user_id = ? FOR UPDATE`,
                [mentorId]
            );
            const [[{ active }]] = await connection.execute(
                `SELECT COUNT(*) AS active FROM mentorships WHERE mentor_id = ? AND status = 'ACTIVE'`,
                [mentorId]
            );
            if (!mentor || Number(active) >= Number(mentor.max_active_mentees)) return "full";

            const [result] = await connection.execute(
                `UPDATE mentorships SET status = 'ACTIVE', response = ?, started_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING'`,
                [response ?? null, id]
            );
            if (!result.affectedRows) return "stale";

            await connection.execute(
                `INSERT INTO mentorship_events (mentorship_id, actor_id, from_status, to_status) VALUES (?, ?, 'PENDING', 'ACTIVE')`,
                [id, mentorId]
            );
            return "accepted";
        });
    },

    // Compare-and-set for every other status change: the row only changes if it is still in the
    // status the caller saw. Returns true when this call made the change.
    async transition({ id, from, to, actorId, response, closingNote, markEnded = false }) {
        return inTransaction(async (connection) => {
            const sets = ["status = ?"];
            const params = [to];
            if (response !== undefined) {
                sets.push("response = ?");
                params.push(response);
            }
            if (closingNote !== undefined) {
                sets.push("closing_note = ?");
                params.push(closingNote);
            }
            if (markEnded) sets.push("ended_at = CURRENT_TIMESTAMP");

            const [result] = await connection.execute(
                `UPDATE mentorships SET ${sets.join(", ")} WHERE id = ? AND status = ?`,
                [...params, id, from]
            );
            if (!result.affectedRows) return false;

            await connection.execute(
                `INSERT INTO mentorship_events (mentorship_id, actor_id, from_status, to_status) VALUES (?, ?, ?, ?)`,
                [id, actorId, from, to]
            );
            return true;
        });
    },

    async findEvents(mentorshipId) {
        const [rows] = await pool.execute(
            `SELECT actor_id, from_status, to_status, created_at FROM mentorship_events WHERE mentorship_id = ? ORDER BY id ASC`,
            [mentorshipId]
        );
        return rows;
    },

    // ---------- goals ----------

    async findGoals(mentorshipId) {
        const [rows] = await pool.execute(
            `SELECT id, title, status, created_by, created_at, completed_at FROM mentorship_goals WHERE mentorship_id = ? ORDER BY id ASC`,
            [mentorshipId]
        );
        return rows;
    },

    async createGoal(mentorshipId, title, createdBy) {
        const [result] = await pool.execute(
            `INSERT INTO mentorship_goals (mentorship_id, title, created_by) VALUES (?, ?, ?)`,
            [mentorshipId, title, createdBy]
        );
        return result.insertId;
    },

    // the goal must belong to that mentorship; only an actual change counts
    async setGoalStatus(goalId, mentorshipId, status) {
        const [result] = await pool.execute(
            `
            UPDATE mentorship_goals
            SET status = ?, completed_at = IF(? = 'DONE', CURRENT_TIMESTAMP, NULL)
            WHERE id = ? AND mentorship_id = ? AND status <> ?
            `,
            [status, status, goalId, mentorshipId, status]
        );
        return result.affectedRows;
    },

    async findGoal(goalId, mentorshipId) {
        const [rows] = await pool.execute(
            `SELECT id, title, status FROM mentorship_goals WHERE id = ? AND mentorship_id = ? LIMIT 1`,
            [goalId, mentorshipId]
        );
        return rows[0];
    },

    // ---------- sessions ----------

    async findSessions(mentorshipId) {
        const [rows] = await pool.execute(
            `
            SELECT id, DATE_FORMAT(session_date, '%Y-%m-%d') AS session_date, duration_minutes, notes, created_by, created_at
            FROM mentorship_sessions
            WHERE mentorship_id = ?
            ORDER BY session_date DESC, id DESC
            `,
            [mentorshipId]
        );
        return rows;
    },

    async createSession(mentorshipId, { sessionDate, durationMinutes, notes }, createdBy) {
        const [result] = await pool.execute(
            `INSERT INTO mentorship_sessions (mentorship_id, session_date, duration_minutes, notes, created_by) VALUES (?, ?, ?, ?, ?)`,
            [mentorshipId, sessionDate, durationMinutes ?? null, notes, createdBy]
        );
        return result.insertId;
    },
};

module.exports = MentorshipRepository;
module.exports.buildMentorFilter = buildMentorFilter;
module.exports.buildMentorshipFilter = buildMentorshipFilter;
