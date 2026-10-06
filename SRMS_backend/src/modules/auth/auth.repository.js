const pool = require("../../config/db");

const AuthRepository = {

    async findStudentByEnrollmentAndDob(enrollment, dob) {
        const [result] = await pool.execute(
            `
        SELECT *
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
        SELECT *
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
        SELECT id, enrollment, email, email_verified, role, status
        FROM users
        WHERE enrollment = ?
        LIMIT 1
        `,
            [enrollment]
        );
        return result[0];
    },

    async createUser(connection, userData) {
        const { enrollment, email, passwordHash, role, status } = userData;
        const [result] = await connection.execute(
            `INSERT INTO users (enrollment, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)`,
            [enrollment, email, passwordHash, role, status]
        );
        return result.insertId;
    },

    async createProfile(connection, profileData) {
        const { userId, fullName, branch = null, batchYear = null } = profileData

        const [result] = await connection.execute(
            `
        INSERT INTO profiles (
            user_id,
            full_name,
            branch,
            batch_year
        )
        VALUES (?, ?, ?, ?)
        `,
            [userId, fullName, branch, batchYear]
        );

        return result.insertId;

    },

    async findUserForLogin(enrollment) {
        const [user] = await pool.execute(
            `
            SELECT
                id,
                password_hash,
                status,
                role,
                failed_login_attempts,
                (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked,
                GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, NOW(), locked_until) / 60)) AS lock_minutes
            FROM users
            WHERE enrollment=?
            LIMIT 1
            `, [enrollment]
        )
        return user[0]
    },

    // Increments the failure counter and locks the account once maxAttempts is reached.
    // MySQL evaluates SET assignments left to right, so locked_until must come first
    // to see the counter *before* this increment.
    async registerFailedLogin(userId, maxAttempts, lockMinutes) {
        await pool.execute(
            `
            UPDATE users
            SET locked_until = IF(failed_login_attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until),
                failed_login_attempts = failed_login_attempts + 1
            WHERE id = ?
            `,
            [maxAttempts, lockMinutes, userId]
        );
    },

    // Used by the auth middleware and the socket handshake on every authenticated request.
    async findActiveSession(userId, tokenHash) {
        const [rows] = await pool.execute(
            `
            SELECT s.id, s.user_id, u.role, u.status
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.user_id = ?
              AND s.token_hash = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > ?
            LIMIT 1
            `,
            [userId, tokenHash, new Date()]
        );
        return rows[0];
    },

    async revokeAllSessions(connection, userId) {
        await connection.execute(
            `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`,
            [userId]
        );
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
        SET last_login = CURRENT_TIMESTAMP,
            failed_login_attempts = 0,
            locked_until = NULL
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

    async updateUserPassword(connection, userId, passwordHash) {
        const [result] = await connection.execute(
            `
            UPDATE users
            SET
            password_hash=?,
            failed_login_attempts = 0,
            locked_until = NULL
            WHERE id=?
            `, [passwordHash, userId]
        )
        return result.affectedRows
    },
    async markResetTokenUsed(connection, resetId) {
        const [result] = await connection.execute(
            `
            UPDATE password_resets
            SET
            used_at=CURRENT_TIMESTAMP
            WHERE id=?
            `, [resetId]
        )
        return result.affectedRows
    },

    async findUserByEnrollmentForOtp(enrollment) {
        const [result] = await pool.execute(
            `SELECT id, enrollment, email, role, status FROM users WHERE enrollment = ?`,
            [enrollment]
        );
        return result[0];
    },

    async createOtp(connection, { userId, otpHash, purpose, expiresAt }) {
        const [result] = await connection.execute(
            `
        INSERT INTO otp_verifications (user_id, otp_hash, purpose, expires_at)
        VALUES (?, ?, ?, ?)
        `,
            [userId, otpHash, purpose, expiresAt]
        );
        return result.insertId;
    },

    async invalidatePreviousOtps(connection, userId, purpose) {
        await connection.execute(
            `
        UPDATE otp_verifications
        SET is_used = 1
        WHERE user_id = ? AND purpose = ? AND is_used = 0
        `,
            [userId, purpose]
        );
    },

    async findLatestValidOtp(userId, purpose) {
        const [result] = await pool.execute(
            `
        SELECT * FROM otp_verifications
        WHERE user_id = ? AND purpose = ? AND is_used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        `,
            [userId, purpose]
        );
        return result[0];
    },

    async incrementOtpAttempts(otpId) {
        await pool.execute(
            `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
            [otpId]
        );
    },

    async markOtpUsed(connection, otpId) {
        await connection.execute(
            `UPDATE otp_verifications SET is_used = 1 WHERE id = ?`,
            [otpId]
        );
    },
    async markEmailVerified(connection, userId) {
        await connection.execute(
            `UPDATE users SET email_verified = 1 WHERE id = ?`,
            [userId]
        );
    }

};

module.exports = AuthRepository;