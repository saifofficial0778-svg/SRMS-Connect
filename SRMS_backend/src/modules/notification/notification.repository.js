const pool = require("../../config/db");

// Every read/update below is scoped by recipient_id, and anything shown to a user is also
// hidden when the person who triggered it is no longer an ACTIVE account (same rule as search).
const VISIBLE = `n.recipient_id = ? AND (n.actor_id IS NULL OR a.status = 'ACTIVE')`;

const SELECT_VISIBLE = `
    SELECT
        n.id,
        n.type,
        n.reference_id,
        n.extra,
        n.is_read,
        n.created_at,
        n.actor_id,
        p.full_name AS actor_name,
        p.profile_photo AS actor_photo
    FROM notifications n
    LEFT JOIN users a ON a.id = n.actor_id
    LEFT JOIN profiles p ON p.user_id = n.actor_id`;

const NotificationRepository = {

    // Inserts unless this recipient already has a notification with the same dedupe_key.
    // INSERT IGNORE + affectedRows is deterministic here: 1 = new row, 0 = duplicate (or the
    // recipient isn't an ACTIVE account, in which case nothing is created).
    // Returns the new id, or null when nothing was created.
    async insertIfNew({ recipientId, actorId, type, referenceId, extra, dedupeKey }) {
        const [result] = await pool.execute(
            `
            INSERT IGNORE INTO notifications (recipient_id, actor_id, type, reference_id, extra, dedupe_key)
            SELECT u.id, ?, ?, ?, ?, ?
            FROM users u
            WHERE u.id = ? AND u.status = 'ACTIVE'
            `,
            [actorId ?? null, type, referenceId ?? null, extra ?? null, dedupeKey, recipientId]
        );
        return result.affectedRows === 1 ? result.insertId : null;
    },

    // For "latest activity" notifications (new messages): refreshes an existing one and makes it
    // unread again instead of piling up one row per message. Returns its id, or null.
    async bumpByDedupeKey({ recipientId, actorId, extra, dedupeKey }) {
        const [result] = await pool.execute(
            `
            UPDATE notifications
            SET actor_id = ?, extra = ?, is_read = 0, read_at = NULL, created_at = CURRENT_TIMESTAMP
            WHERE recipient_id = ? AND dedupe_key = ?
            `,
            [actorId ?? null, extra ?? null, recipientId, dedupeKey]
        );
        if (!result.affectedRows) return null;

        const [rows] = await pool.execute(
            `SELECT id FROM notifications WHERE recipient_id = ? AND dedupe_key = ? LIMIT 1`,
            [recipientId, dedupeKey]
        );
        return rows[0]?.id ?? null;
    },

    async findVisibleById(id, recipientId) {
        const [rows] = await pool.execute(
            `${SELECT_VISIBLE} WHERE n.id = ? AND ${VISIBLE} LIMIT 1`,
            [id, recipientId]
        );
        return rows[0];
    },

    // limit/offset are validated integers (execute() can't bind LIMIT placeholders)
    async findByRecipient(recipientId, { limit, offset, unreadOnly }) {
        const [rows] = await pool.execute(
            `
            ${SELECT_VISIBLE}
            WHERE ${VISIBLE} ${unreadOnly ? "AND n.is_read = 0" : ""}
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT ${limit} OFFSET ${offset}
            `,
            [recipientId]
        );
        return rows;
    },

    async countByRecipient(recipientId, { unreadOnly = false } = {}) {
        const [rows] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM notifications n
            LEFT JOIN users a ON a.id = n.actor_id
            WHERE ${VISIBLE} ${unreadOnly ? "AND n.is_read = 0" : ""}
            `,
            [recipientId]
        );
        return rows[0].total;
    },

    // One notification per ACTIVE connection of `actorId` (e.g. "your connection posted a job").
    // INSERT IGNORE + the (recipient_id, dedupe_key) unique key make a repeat a no-op, and the LIMIT
    // keeps one action from fanning out without bound. Returns how many were created.
    async insertForConnections({ actorId, type, referenceId, extra, dedupeKey, limit }) {
        const [result] = await pool.execute(
            `
            INSERT IGNORE INTO notifications (recipient_id, actor_id, type, reference_id, extra, dedupe_key)
            SELECT u.id, ?, ?, ?, ?, ?
            FROM connections c
            JOIN users u ON u.id = IF(c.sender_id = ?, c.receiver_id, c.sender_id)
            WHERE c.status = 'ACCEPTED'
              AND (c.sender_id = ? OR c.receiver_id = ?)
              AND u.status = 'ACTIVE'
            LIMIT ${limit}
            `,
            [actorId, type, referenceId, extra ?? null, dedupeKey, actorId, actorId, actorId]
        );
        return result.affectedRows;
    },

    async findByDedupeKey(dedupeKey) {
        const [rows] = await pool.execute(
            `SELECT id, recipient_id FROM notifications WHERE dedupe_key = ?`,
            [dedupeKey]
        );
        return rows;
    },

    // true when this recipient owns a notification with that id
    async existsForRecipient(id, recipientId) {
        const [rows] = await pool.execute(
            `SELECT 1 FROM notifications WHERE id = ? AND recipient_id = ? LIMIT 1`,
            [id, recipientId]
        );
        return rows.length > 0;
    },

    async markRead(id, recipientId) {
        const [result] = await pool.execute(
            `
            UPDATE notifications
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE id = ? AND recipient_id = ? AND is_read = 0
            `,
            [id, recipientId]
        );
        return result.affectedRows;
    },

    async markAllRead(recipientId) {
        const [result] = await pool.execute(
            `
            UPDATE notifications
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE recipient_id = ? AND is_read = 0
            `,
            [recipientId]
        );
        return result.affectedRows;
    },

    async markReadByReference(recipientId, type, referenceId) {
        const [result] = await pool.execute(
            `
            UPDATE notifications
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE recipient_id = ? AND type = ? AND reference_id = ? AND is_read = 0
            `,
            [recipientId, type, referenceId]
        );
        return result.affectedRows;
    },

    // used for connection requests: the request is handled, so its notification is done
    async markReadByDedupeKey(dedupeKey) {
        const [result] = await pool.execute(
            `
            UPDATE notifications
            SET is_read = 1, read_at = CURRENT_TIMESTAMP
            WHERE dedupe_key = ? AND is_read = 0
            `,
            [dedupeKey]
        );
        return result.affectedRows;
    },

    // returns the recipients that had one, so their clients can be told
    async deleteByDedupeKey(dedupeKey) {
        const [rows] = await pool.execute(
            `SELECT recipient_id FROM notifications WHERE dedupe_key = ?`,
            [dedupeKey]
        );
        if (!rows.length) return [];
        await pool.execute(`DELETE FROM notifications WHERE dedupe_key = ?`, [dedupeKey]);
        return rows.map((r) => r.recipient_id);
    },

    // e.g. every like/comment notification of a deleted post
    async deleteByReference(types, referenceId) {
        const placeholders = types.map(() => "?").join(",");
        const [rows] = await pool.execute(
            `SELECT DISTINCT recipient_id FROM notifications WHERE type IN (${placeholders}) AND reference_id = ?`,
            [...types, referenceId]
        );
        if (!rows.length) return [];
        await pool.execute(
            `DELETE FROM notifications WHERE type IN (${placeholders}) AND reference_id = ?`,
            [...types, referenceId]
        );
        return rows.map((r) => r.recipient_id);
    },
};

module.exports = NotificationRepository;
