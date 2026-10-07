// Campus Spotlight: announcements the admin publishes to everyone's home page - events, workshops,
// placement drives, guest lectures, hackathons, programmes.
//
//   status      DRAFT (only admins see it) -> PUBLISHED -> ARCHIVED
//   publish_at  optional schedule: a PUBLISHED card stays hidden until this moment
//   starts_at / ends_at  when the event happens; a card disappears on its own once it is over
//
// Members only ever get PUBLISHED cards whose publish time has come and that have not ended
// (enforced in the repository query, not in the client).
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS campus_spotlights (
                id BIGINT NOT NULL AUTO_INCREMENT,
                title VARCHAR(120) NOT NULL,
                description VARCHAR(600) NOT NULL,
                category ENUM('EVENT','WORKSHOP','PLACEMENT','GUEST_LECTURE','SEMINAR','HACKATHON','PROGRAM','ANNOUNCEMENT') NOT NULL DEFAULT 'EVENT',
                image_url VARCHAR(500) NULL,
                starts_at DATETIME NULL,
                ends_at DATETIME NULL,
                location VARCHAR(150) NULL,
                is_online TINYINT(1) NOT NULL DEFAULT 0,
                cta_label VARCHAR(40) NULL,
                cta_url VARCHAR(500) NULL,
                status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
                publish_at DATETIME NULL,
                created_by BIGINT NOT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_spotlights_visible (status, publish_at, starts_at),
                CONSTRAINT fk_spotlights_creator FOREIGN KEY (created_by) REFERENCES users (id),
                CONSTRAINT chk_spotlight_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS campus_spotlights");
    },
};
