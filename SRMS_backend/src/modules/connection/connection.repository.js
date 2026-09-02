const pool = require("../../config/db");

const ConnectionRepository = {

    async findConnection(senderId, receiverId) {
        const [result] = await pool.execute(
            `
        SELECT id, sender_id, receiver_id, status
        FROM connections
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
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
    }

};

module.exports = ConnectionRepository;