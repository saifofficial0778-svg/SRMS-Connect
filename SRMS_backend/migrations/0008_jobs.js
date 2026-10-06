// Alumni job board.
//
//   jobs.status         OPEN (listed) | CLOSED (poster stopped hiring; still viewable by link, not listed)
//                       | DELETED (soft delete, same approach as posts; hidden everywhere)
//   jobs.apply_url      the application flow is an external https link chosen by the poster - the safest
//                       option: no applicant data or emails are stored or exposed by SRMS Connect
//   experience_min/max  years of experience the role asks for (max NULL = "min and above")
//   job_skills          required skills, same shape as profile_skills
//
// Indexes: (status, created_at) for the listing, (poster_id, status) for "my jobs" and the
// per-poster open-jobs quota, (company) and (job_type, status) for filters, job_skills(skill).
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id BIGINT NOT NULL AUTO_INCREMENT,
                poster_id BIGINT NOT NULL,
                title VARCHAR(150) NOT NULL,
                company VARCHAR(150) NOT NULL,
                location VARCHAR(150) NOT NULL,
                job_type ENUM('FULL_TIME','PART_TIME','INTERNSHIP','CONTRACT','FREELANCE') NOT NULL,
                experience_min TINYINT UNSIGNED NOT NULL DEFAULT 0,
                experience_max TINYINT UNSIGNED NULL,
                description TEXT NOT NULL,
                apply_url VARCHAR(500) NOT NULL,
                status ENUM('OPEN','CLOSED','DELETED') NOT NULL DEFAULT 'OPEN',
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (id),
                KEY idx_jobs_status_created (status, created_at, id),
                KEY idx_jobs_poster_status (poster_id, status),
                KEY idx_jobs_company (company),
                KEY idx_jobs_type_status (job_type, status),
                CONSTRAINT fk_jobs_poster FOREIGN KEY (poster_id) REFERENCES users (id),
                CONSTRAINT chk_jobs_experience CHECK (experience_max IS NULL OR experience_max >= experience_min)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS job_skills (
                id BIGINT NOT NULL AUTO_INCREMENT,
                job_id BIGINT NOT NULL,
                skill VARCHAR(100) NOT NULL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_job_skill (job_id, skill),
                KEY idx_job_skills_skill (skill),
                CONSTRAINT fk_job_skills_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS job_skills");
        await conn.query("DROP TABLE IF EXISTS jobs");
    },
};
