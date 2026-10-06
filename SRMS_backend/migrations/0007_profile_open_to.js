// "Open to" career intents on a profile (mentorship, referrals, ...). One row per (profile, intent),
// same shape as profile_skills, so it can be filtered in search with an index lookup.
// Existing profiles simply have no rows: nothing is changed or backfilled.
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS profile_open_to (
                id BIGINT NOT NULL AUTO_INCREMENT,
                profile_id BIGINT NOT NULL,
                intent ENUM('MENTORSHIP','REFERRALS','RESUME_REVIEW','MOCK_INTERVIEW','HIRING') NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_profile_open_to (profile_id, intent),
                KEY idx_open_to_intent (intent, profile_id),
                CONSTRAINT fk_open_to_profile FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS profile_open_to");
    },
};
