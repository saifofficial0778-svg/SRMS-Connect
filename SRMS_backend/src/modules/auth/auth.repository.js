const pool = require("../../config/db");

const AuthRepository = {

    async findStudentByEnrollmentAndDob(enrollment, dob) {
        const [result] = await pool.execute(
            `
        SELECT enrollment,
        full_name
        FROM student_master
        WHERE enrollment = ?
        AND dob = ?
        LIMIT 1
        `,
            [enrollment, dob]
        );

        return result[0];
    },

    async findAlumniByEnrollmentAndDob(enrollment, dob) {
        const [result] = await pool.execute(
            `
        SELECT enrollment,
        full_name
        FROM alumni_master
        WHERE enrollment = ?
        AND dob = ?
        LIMIT 1
        `,
            [enrollment, dob]
        );

        return result[0];
    },

    async findUserByEnrollment(enrollment) {
        const [result] = await pool.execute(
            `
        SELECT enrollment
        FROM users
        WHERE enrollment = ?
        LIMIT 1
        `,
            [enrollment]
        );

        return result[0];
    },

    async createUser(connection,userData) {
        const {
            enrollment,
            passwordHash,
            role,
            status
        } = userData;

        const [result] = await connection.execute(
            `
        INSERT INTO users (
            enrollment,
            password_hash,
            role,
            status
        )
        VALUES (?, ?, ?, ?)
        `,
            [enrollment, passwordHash, role, status]
        );

        return result.insertId;
    },

    async createProfile(connection,profileData){
        const {userId,fullName}=profileData

        const [result] = await connection.execute(
            `
        INSERT INTO profiles (
            user_id,
            full_name
        )
        VALUES (?, ?)
        `,
            [userId,fullName]
        );

        return result.insertId;

    },

    async findUserForLogin(enrollment) {
        const [user] = await pool.execute(
            `
            SELECT id , password_hash,status,role
            FROM users
            WHERE enrollment=?
            LIMIT 1
            `, [enrollment]
        )
        return user[0]
    },

    async createSession(connection, sessionData) {
        const { userId, tokenHash, deviceInfo, ipAddress, expiresAt } = sessionData;

        const [result] = await connection.execute(
            `
            INSERT INTO user_sessions(
            user_id,
            token_hash,
            device_info,
            ip_address,
            expires_at
            )
            VALUES (?, ?, ?, ?, ?)
            `, [userId, tokenHash, deviceInfo, ipAddress, expiresAt]
        )
        return result.insertId
    },
    async updateLastLogin(connection, userId) {
        const [result] = await connection.execute(
            `
        UPDATE users
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
            [userId]
        );

        return result.affectedRows;
    },

    async revokeSession(userId, tokenHash) {
        const [result] = await pool.execute(
            `
            UPDATE user_sessions
            SET revoked_at=CURRENT_TIMESTAMP
            WHERE
                user_id=?
                AND token_hash=?
            `, [userId, tokenHash]
        )
        return result.affectedRows
    },

    async createPasswordReset(userId, tokenHash, expiresAt) {
        const [result] = await pool.execute(
            `
            INSERT INTO password_resets(
            user_id,
            token_hash,
            expires_at
            )
            VALUES (?, ?, ?)
            `, [userId, tokenHash, expiresAt]
        )
        return result.insertId
    },

    async findResetToken(tokenHash) {
        const [result] = await pool.execute(
            `
            SELECT id, user_id, token_hash, expires_at, used_at
            FROM password_resets
            WHERE token_hash = ?
            LIMIT 1
            `, [tokenHash]
        )
        return result[0]
    },

    async updateUserPassword(connection, userId, passwordHash){
        const [result]=await connection.execute(
            `
            UPDATE users
            SET
            password_hash=?
            WHERE id=?
            `,[passwordHash,userId]
        )
        return result.affectedRows
    },
    async markResetTokenUsed(connection, resetId){
        const [result]=await connection.execute(
            `
            UPDATE password_resets
            SET
            used_at=CURRENT_TIMESTAMP
            WHERE id=?
            `,[resetId]
        )
        return result.affectedRows
    }

};

module.exports = AuthRepository;