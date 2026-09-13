const pool = require("../../config/db");

const ConversationRepository = {

    async findConversation(userOneId, userTwoId) {
        const [rows] = await pool.execute(
            `SELECT id, user_one_id, user_two_id
             FROM conversations
             WHERE (user_one_id = ? AND user_two_id = ?)
                OR (user_one_id = ? AND user_two_id = ?)
             LIMIT 1`,
            [userOneId, userTwoId, userTwoId, userOneId]
        );

        return rows[0];
    },

    async createConversation(userOneId, userTwoId) {
        const [result] = await pool.execute(
            `INSERT INTO conversations
                (user_one_id, user_two_id)
             VALUES (?, ?)`,
            [userOneId, userTwoId]
        );

        return result.insertId;
    },

    async createMessage(conversationId, senderId, content) {
        const [result] = await pool.execute(
            `INSERT INTO messages
            (conversation_id, sender_id, content)
         VALUES (?, ?, ?)`,
            [conversationId, senderId, content]
        );

        return result.insertId;
    },

    async findConversationById(conversationId) {
        const [rows] = await pool.execute(
            `SELECT id, user_one_id, user_two_id
         FROM conversations
         WHERE id = ?
         LIMIT 1`,
            [conversationId]
        );

        return rows[0];
    },

   
    async findConversationsByUser(userId) {
        const [rows] = await pool.execute(
            `
            SELECT
                c.id AS conversation_id,
                CASE WHEN c.user_one_id = ? THEN c.user_two_id ELSE c.user_one_id END AS other_user_id,
                pr.full_name,
                pr.profile_photo,
                lm.content AS last_message_content,
                lm.created_at AS last_message_at,
                lm.sender_id AS last_message_sender_id,
                (
                    SELECT COUNT(*)
                    FROM messages m2
                    WHERE m2.conversation_id = c.id
                      AND m2.sender_id <> ?
                      AND m2.is_read = 0
                ) AS unread_count
            FROM conversations c
            JOIN profiles pr
                ON pr.user_id = CASE WHEN c.user_one_id = ? THEN c.user_two_id ELSE c.user_one_id END
            LEFT JOIN messages lm
                ON lm.id = (
                    SELECT m3.id
                    FROM messages m3
                    WHERE m3.conversation_id = c.id
                    ORDER BY m3.created_at DESC, m3.id DESC
                    LIMIT 1
                )
            WHERE c.user_one_id = ? OR c.user_two_id = ?
            ORDER BY (lm.created_at IS NULL) ASC, lm.created_at DESC
            `,
            [userId, userId, userId, userId, userId]
        );

        return rows;
    },

    
    async findMessagesByConversationId(conversationId, limit, offset) {
        const safeLimit = Number.parseInt(limit, 10) || 30;
        const safeOffset = Number.parseInt(offset, 10) || 0;

        const [rows] = await pool.execute(
            `
            SELECT id, conversation_id, sender_id, content, is_read, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
            `,
            [conversationId]
        );

        return rows;
    },

    
    async markConversationRead(conversationId, userId) {
        const [result] = await pool.execute(
            `
            UPDATE messages
            SET is_read = 1
            WHERE conversation_id = ?
              AND sender_id <> ?
              AND is_read = 0
            `,
            [conversationId, userId]
        );

        return result.affectedRows;
    },

};

module.exports = ConversationRepository;
