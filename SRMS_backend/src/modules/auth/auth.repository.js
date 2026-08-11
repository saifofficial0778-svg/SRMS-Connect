const pool = require("../../config/db");

const AuthRepository = {

    async findStudentByEnrollmentAndDob(enrollment, dob) {
        const [result] = await pool.execute(
            `
        SELECT enrollment
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
        SELECT enrollment
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

    async createUser(userData) {
        const {
            enrollment,
            passwordHash,
            role,
            status
        } = userData;

        const [result] = await pool.execute(
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

};

module.exports = AuthRepository;