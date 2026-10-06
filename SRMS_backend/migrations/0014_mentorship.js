// Mentorship.
//
//   mentor_profiles      one row per alumnus who chose to mentor: bio, availability, how many
//                        mentees they take at once, and whether they are accepting requests.
//                        Their expertise is NOT duplicated here: it is their existing profile_skills.
//   mentor_tags          what they mentor on (kind TOPIC) and which students they prefer (kind AREA)
//   mentorships          a student's request to a mentor and the mentorship that follows
//                          PENDING -> ACTIVE (mentor accepts) | REJECTED | CANCELLED (student withdraws)
//                          ACTIVE  -> COMPLETED (either side closes it)
//   mentorship_goals     simple goals inside a mentorship (OPEN / DONE)
//   mentorship_sessions  a log of sessions that happened (date, optional duration, notes)
//   mentorship_events    append-only status history
//
// Duplicate prevention is enforced by the database: active_flag is 1 only while a mentorship is
// PENDING or ACTIVE (NULL otherwise), so the UNIQUE key allows one open mentorship per mentor +
// student, while finished ones stay as history and a new request can be made later.
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mentor_profiles (
                user_id BIGINT NOT NULL,
                bio VARCHAR(600) NOT NULL,
                availability VARCHAR(200) NOT NULL,
                max_active_mentees TINYINT UNSIGNED NOT NULL DEFAULT 3,
                is_accepting TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                KEY idx_mentor_profiles_accepting (is_accepting),
                CONSTRAINT fk_mentor_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT chk_mentor_capacity CHECK (max_active_mentees BETWEEN 1 AND 20)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mentor_tags (
                id BIGINT NOT NULL AUTO_INCREMENT,
                mentor_id BIGINT NOT NULL,
                kind ENUM('TOPIC','AREA') NOT NULL,
                value VARCHAR(100) NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_mentor_tag (mentor_id, kind, value),
                KEY idx_mentor_tags_lookup (kind, value, mentor_id),
                CONSTRAINT fk_mentor_tags_mentor FOREIGN KEY (mentor_id) REFERENCES mentor_profiles (user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mentorships (
                id BIGINT NOT NULL AUTO_INCREMENT,
                mentor_id BIGINT NOT NULL,
                mentee_id BIGINT NOT NULL,
                topic VARCHAR(40) NOT NULL,
                message VARCHAR(1000) NOT NULL,
                response VARCHAR(1000) NULL,
                closing_note VARCHAR(1000) NULL,
                status ENUM('PENDING','ACTIVE','REJECTED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'PENDING',
                started_at TIMESTAMP NULL DEFAULT NULL,
                ended_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                active_flag TINYINT GENERATED ALWAYS AS (IF(status IN ('PENDING','ACTIVE'), 1, NULL)) VIRTUAL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_mentorship_open (mentor_id, mentee_id, active_flag),
                KEY idx_mentorships_mentor (mentor_id, status, created_at),
                KEY idx_mentorships_mentee (mentee_id, status, created_at),
                CONSTRAINT fk_mentorships_mentor FOREIGN KEY (mentor_id) REFERENCES users (id),
                CONSTRAINT fk_mentorships_mentee FOREIGN KEY (mentee_id) REFERENCES users (id),
                CONSTRAINT chk_mentorship_not_self CHECK (mentor_id <> mentee_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mentorship_goals (
                id BIGINT NOT NULL AUTO_INCREMENT,
                mentorship_id BIGINT NOT NULL,
                title VARCHAR(200) NOT NULL,
                status ENUM('OPEN','DONE') NOT NULL DEFAULT 'OPEN',
                created_by BIGINT NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (id),
                KEY idx_mentorship_goals (mentorship_id, id),
                CONSTRAINT fk_mentorship_goals_mentorship FOREIGN KEY (mentorship_id) REFERENCES mentorships (id) ON DELETE CASCADE,
                CONSTRAINT fk_mentorship_goals_user FOREIGN KEY (created_by) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mentorship_sessions (
                id BIGINT NOT NULL AUTO_INCREMENT,
                mentorship_id BIGINT NOT NULL,
                session_date DATE NOT NULL,
                duration_minutes SMALLINT UNSIGNED NULL,
                notes VARCHAR(1000) NOT NULL,
                created_by BIGINT NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_mentorship_sessions (mentorship_id, session_date, id),
                CONSTRAINT fk_mentorship_sessions_mentorship FOREIGN KEY (mentorship_id) REFERENCES mentorships (id) ON DELETE CASCADE,
                CONSTRAINT fk_mentorship_sessions_user FOREIGN KEY (created_by) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS mentorship_events (
                id BIGINT NOT NULL AUTO_INCREMENT,
                mentorship_id BIGINT NOT NULL,
                actor_id BIGINT NULL,
                from_status VARCHAR(20) NULL,
                to_status VARCHAR(20) NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_mentorship_events (mentorship_id, id),
                CONSTRAINT fk_mentorship_events_mentorship FOREIGN KEY (mentorship_id) REFERENCES mentorships (id) ON DELETE CASCADE,
                CONSTRAINT fk_mentorship_events_actor FOREIGN KEY (actor_id) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        for (const table of ["mentorship_events", "mentorship_sessions", "mentorship_goals", "mentorships", "mentor_tags", "mentor_profiles"]) {
            await conn.query(`DROP TABLE IF EXISTS ${table}`);
        }
    },
};
