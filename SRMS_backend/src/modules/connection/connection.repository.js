const pool = require("../../config/db");

const ConnectionRepository = {

    async findConnection(senderId, receiverId) {
        const [result] = await pool.execute(
            `
        SELECT id, sender_id, receiver_id, status
        FROM connections
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY (status IN ('PENDING', 'ACCEPTED')) DESC, id DESC
        LIMIT 1
        `,
            [senderId, receiverId, receiverId, senderId]
        );

        return result[0];
    },

    async createConnection(senderId, receiverId) {
        const [result] = await pool.execute(
            `
        INSERT INTO connections (
            sender_id,
            receiver_id,
            status
        )
        VALUES (?, ?, 'PENDING')
        `,
            [senderId, receiverId]
        );

        return result.insertId;
    },

    async findConnectionById(id) {
        const [rows] = await pool.execute(
            `SELECT id, sender_id, receiver_id, status
         FROM connections
         WHERE id = ?`,
            [id]
        );

        return rows[0];
    },

    async updateStatus(id, status) {
        const [result] = await pool.execute(
            `UPDATE connections
         SET status = ?
         WHERE id = ?`,
            [status, id]
        );

        return result.affectedRows;
    },

    async getMyConnections(userId) {
        const [rows] = await pool.execute(
            `SELECT id, sender_id, receiver_id, status, created_at
         FROM connections
         WHERE (sender_id = ? OR receiver_id = ?)
         AND status = 'ACCEPTED'
         ORDER BY created_at DESC`,
            [userId, userId]
        );

        return rows;
    },

    async getReceivedRequests(userId) {
        const [rows] = await pool.execute(
            `SELECT id, sender_id, receiver_id, status, created_at
         FROM connections
         WHERE receiver_id = ?
         AND status = 'PENDING'
         ORDER BY created_at DESC`,
            [userId]
        );

        return rows;
    },

    async getSentRequests(userId) {
        const [rows] = await pool.execute(
            `SELECT id, sender_id, receiver_id, status, created_at
         FROM connections
         WHERE sender_id = ?
         AND status = 'PENDING'
         ORDER BY created_at DESC`,
            [userId]
        );

        return rows;
    },

    // The ACTIVE members someone is connected with, and how the viewer stands with each of them.
    // The viewer is left out. People the viewer is not connected with yet come first.
    // limit is a validated integer (execute() can't bind LIMIT placeholders)
    async findConnectionsOfUser(profileUserId, viewerId, limit) {
        const [rows] = await pool.execute(
            `
            SELECT
                u.id AS user_id,
                u.role,
                p.full_name,
                p.profile_photo,
                p.company,
                p.designation,
                p.branch,
                p.batch_year,
                vc.id AS viewer_connection_id,
                vc.status AS viewer_status,
                vc.sender_id AS viewer_sender_id
            FROM connections c
            JOIN users u
                ON u.id = IF(c.sender_id = ?, c.receiver_id, c.sender_id)
               AND u.status = 'ACTIVE'
               AND u.role <> 'ADMIN'
            JOIN profiles p ON p.user_id = u.id
            LEFT JOIN connections vc
                ON vc.status IN ('PENDING', 'ACCEPTED')
               AND ((vc.sender_id = ? AND vc.receiver_id = u.id) OR (vc.receiver_id = ? AND vc.sender_id = u.id))
            WHERE c.status = 'ACCEPTED'
              AND (c.sender_id = ? OR c.receiver_id = ?)
              AND u.id <> ?
            ORDER BY (vc.id IS NULL) DESC, p.full_name ASC, u.id ASC
            LIMIT ${limit}
            `,
            [profileUserId, viewerId, viewerId, profileUserId, profileUserId, viewerId]
        );

        return rows;
    },

    // ACTIVE members the viewer has no live connection with, ranked by how many accepted
    // connections they share with the viewer, then by same branch. Each row says why it is there.
    // limit is a validated integer (execute() can't bind LIMIT placeholders)
    async findSuggestions(viewerId, limit) {
        const [rows] = await pool.execute(
            `
            SELECT
                u.id AS user_id,
                u.role,
                p.full_name,
                p.profile_photo,
                p.company,
                p.designation,
                p.branch,
                p.batch_year,
                (
                    SELECT COUNT(*)
                    FROM connections mine
                    JOIN connections theirs
                        ON theirs.status = 'ACCEPTED'
                       AND (
                            (theirs.sender_id = u.id AND theirs.receiver_id = IF(mine.sender_id = ?, mine.receiver_id, mine.sender_id))
                         OR (theirs.receiver_id = u.id AND theirs.sender_id = IF(mine.sender_id = ?, mine.receiver_id, mine.sender_id))
                       )
                    WHERE mine.status = 'ACCEPTED' AND (mine.sender_id = ? OR mine.receiver_id = ?)
                ) AS mutual_connections,
                (p.branch IS NOT NULL AND p.branch = (SELECT me.branch FROM profiles me WHERE me.user_id = ?)) AS same_branch
            FROM users u
            JOIN profiles p ON p.user_id = u.id
            WHERE u.status = 'ACTIVE'
              AND u.role <> 'ADMIN'
              AND u.id <> ?
              AND NOT EXISTS (
                    SELECT 1 FROM connections c
                    WHERE c.status IN ('PENDING', 'ACCEPTED')
                      AND ((c.sender_id = ? AND c.receiver_id = u.id) OR (c.receiver_id = ? AND c.sender_id = u.id))
              )
            ORDER BY mutual_connections DESC, same_branch DESC, (u.role = 'ALUMNI') DESC, u.id DESC
            LIMIT ${limit}
            `,
            [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, viewerId]
        );

        return rows;
    }

};

module.exports = ConnectionRepository;