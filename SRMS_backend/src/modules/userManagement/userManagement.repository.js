const pool = require('../../config/db')

const UserRepository = {

    async findUsers(filters, offset, limit) {
        const { role, status, search } = filters
        let query =
            `
            SELECT 
                id,
                enrollment,
                email,
                role,
                status,
                last_login,
                created_at
            FROM users
            WHERE 1=1
            `;


        const params = []

        if (role) {
            query += ` AND role=?`
            params.push(role)
        }

        if (status) {
            query += ` AND status=?`
            params.push(status)
        }

        if (search) {
            query += ` AND enrollment LIKE ?`
            params.push(`%${search}%`)
        }

        query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;


        const [result] = await pool.execute(query, params)

        return result
    },

    async countUsers(filters) {
        const { role, status, search } = filters;

        let query = `
        SELECT COUNT(*) AS total
        FROM users
        WHERE 1=1
    `;

        const params = [];

        if (role) {
            query += ` AND role = ?`;
            params.push(role);
        }

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }

        if (search) {
            query += ` AND enrollment LIKE ?`;
            params.push(`%${search}%`);
        }

        const [result] = await pool.execute(query, params);

        return result[0].total;
    },

    async findUserById(id) {
        const [result] = await pool.execute(
            `
            SELECT 
                id,
                role,
                status
            FROM 
                users
            WHERE
                id=?
            `, [id]
        )
        return result[0]
    },

    async updateUserStatus(id, status, adminId, reason = null) {
        const [result] = await pool.execute(
            `
        UPDATE users
        SET 
            status = ?,
            verified_by = ?,
            verified_at = NOW(),
            rejection_reason = ?
        WHERE id = ?
        `,
            [status, adminId, reason, id]
        );
        return result.affectedRows;
    },



};

module.exports = UserRepository;