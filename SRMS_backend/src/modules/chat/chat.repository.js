const pool = require("../../config/db");

const ConversationRepository = {

    async findConversation(userOneId, userTwoId) {
        const [rows] = await pool.execute(
            `SELECT id, user_one_id, user_two_id
             FROM conversations
             WHERE user_one_id = ?
               AND user_two_id = ?
             LIMIT 1`,
            [userOneId, userTwoId]
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

};

module.exports = ConversationRepository;