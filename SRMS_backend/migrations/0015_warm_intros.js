// Warm introductions: a student asks a mutual alumnus to introduce them to another alumnus.
//
//   requester_id   the student who wants the introduction
//   target_id      the alumnus they want to reach
//   introducer_id  the mutual alumnus (connected to both) who is asked to introduce them
//   status         PENDING -> INTRODUCED (the introducer agreed; only then is the target told)
//                           | DECLINED | CANCELLED (the student withdrew)
//
// Nothing is ever sent to the target unless the introducer acts.
// The UNIQUE key allows one PENDING request per student + target (active_flag is NULL once it is
// resolved), so a student can't ask several people at once to introduce them to the same person.
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS warm_intros (
                id BIGINT NOT NULL AUTO_INCREMENT,
                requester_id BIGINT NOT NULL,
                target_id BIGINT NOT NULL,
                introducer_id BIGINT NOT NULL,
                message VARCHAR(600) NOT NULL,
                introducer_note VARCHAR(600) NULL,
                status ENUM('PENDING','INTRODUCED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING',
                responded_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                active_flag TINYINT GENERATED ALWAYS AS (IF(status = 'PENDING', 1, NULL)) VIRTUAL,
                PRIMARY KEY (id),
                UNIQUE KEY uq_warm_intro_pending (requester_id, target_id, active_flag),
                KEY idx_warm_intros_introducer (introducer_id, status, created_at),
                KEY idx_warm_intros_requester (requester_id, created_at),
                KEY idx_warm_intros_target (target_id, status, created_at),
                CONSTRAINT fk_warm_intros_requester FOREIGN KEY (requester_id) REFERENCES users (id),
                CONSTRAINT fk_warm_intros_target FOREIGN KEY (target_id) REFERENCES users (id),
                CONSTRAINT fk_warm_intros_introducer FOREIGN KEY (introducer_id) REFERENCES users (id),
                CONSTRAINT chk_warm_intro_distinct CHECK (
                    requester_id <> target_id AND requester_id <> introducer_id AND target_id <> introducer_id
                )
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS warm_intros");
    },
};
