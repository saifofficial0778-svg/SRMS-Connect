// Career help: one table for the three request flows a student can start with an alumnus.
//
//   type          REFERRAL (always tied to a job) | RESUME_REVIEW | QUESTION ("Ask an Alumni")
//   requester_id  the student who asked            alumni_id  the alumnus who was asked
//   message       fit note / what to look at / the question
//   resume_url    https link to the resume (required for RESUME_REVIEW, optional for REFERRAL)
//   response      the alumnus's note, feedback or answer
//   status        PENDING -> ACCEPTED | REJECTED | CANCELLED | ANSWERED (questions)
//                 ACCEPTED -> COMPLETED (referred / review done) | CANCELLED
//
// Duplicate prevention is enforced by the database, not just the code:
//   active_flag is 1 only while a request is PENDING or ACCEPTED (NULL otherwise), and job_ref is
//   the job id (0 when there is none), so the UNIQUE key allows exactly one *active* request per
//   type + student + alumnus + job. Finished requests have a NULL flag, which never collides, so
//   history is kept and a new request can be made later.
//
// career_request_events is the append-only status history of each request.
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS career_requests (
                id BIGINT NOT NULL AUTO_INCREMENT,
                type ENUM('REFERRAL','RESUME_REVIEW','QUESTION') NOT NULL,
                requester_id BIGINT NOT NULL,
                alumni_id BIGINT NOT NULL,
                job_id BIGINT NULL,
                message VARCHAR(1000) NOT NULL,
                resume_url VARCHAR(500) NULL,
                response VARCHAR(2000) NULL,
                status ENUM('PENDING','ACCEPTED','REJECTED','CANCELLED','COMPLETED','ANSWERED') NOT NULL DEFAULT 'PENDING',
                responded_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                job_ref BIGINT GENERATED ALWAYS AS (COALESCE(job_id, 0)) VIRTUAL,
                active_flag TINYINT GENERATED ALWAYS AS (IF(status IN ('PENDING','ACCEPTED'), 1, NULL)) VIRTUAL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_career_active_request (type, requester_id, alumni_id, job_ref, active_flag),
                KEY idx_career_requester (requester_id, status, created_at),
                KEY idx_career_alumni (alumni_id, status, created_at),
                KEY idx_career_job (job_id, status),
                CONSTRAINT fk_career_requester FOREIGN KEY (requester_id) REFERENCES users (id),
                CONSTRAINT fk_career_alumni FOREIGN KEY (alumni_id) REFERENCES users (id),
                CONSTRAINT fk_career_job FOREIGN KEY (job_id) REFERENCES jobs (id),
                CONSTRAINT chk_career_not_self CHECK (requester_id <> alumni_id),
                CONSTRAINT chk_career_job_for_referral CHECK ((type = 'REFERRAL') = (job_id IS NOT NULL))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS career_request_events (
                id BIGINT NOT NULL AUTO_INCREMENT,
                request_id BIGINT NOT NULL,
                actor_id BIGINT NULL,
                from_status VARCHAR(20) NULL,
                to_status VARCHAR(20) NOT NULL,
                note VARCHAR(255) NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_career_events_request (request_id, id),
                CONSTRAINT fk_career_events_request FOREIGN KEY (request_id) REFERENCES career_requests (id) ON DELETE CASCADE,
                CONSTRAINT fk_career_events_actor FOREIGN KEY (actor_id) REFERENCES users (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS career_request_events");
        await conn.query("DROP TABLE IF EXISTS career_requests");
    },
};
