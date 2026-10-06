// notifications: one row per thing a user should be told about.
//
//   recipient_id  who sees it (every query is scoped by this - users never read each other's rows)
//   actor_id      who caused it (NULL for system/admin notices, which are shown as "SRMS")
//   reference_id  what it points at: connection id / post id / conversation id (see `type`)
//   extra         short context: comment/message snippet, or APPROVED / REINSTATED for account notices
//   dedupe_key    identifies "the same action"; UNIQUE with recipient_id so repeating an action
//                 (e.g. like -> unlike -> like) can never create a second notification
//
// Indexes:
//   (recipient_id, created_at, id)   notification list, newest first
//   (recipient_id, is_read, created_at)  unread count / unread-only list / mark-all-read
//   (type, reference_id)             cleanup when a post is deleted / conversation is read
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGINT NOT NULL AUTO_INCREMENT,
                recipient_id BIGINT NOT NULL,
                actor_id BIGINT NULL,
                type ENUM('CONNECTION_REQUEST','CONNECTION_ACCEPTED','POST_LIKE','POST_COMMENT','NEW_MESSAGE','ACCOUNT_STATUS') NOT NULL,
                reference_id BIGINT NULL,
                extra VARCHAR(255) NULL,
                dedupe_key VARCHAR(120) NOT NULL,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                read_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_notifications_dedupe (recipient_id, dedupe_key),
                KEY idx_notifications_recipient_created (recipient_id, created_at, id),
                KEY idx_notifications_recipient_read (recipient_id, is_read, created_at),
                KEY idx_notifications_reference (type, reference_id),
                KEY idx_notifications_actor (actor_id),
                CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    // this migration creates the table, so reverting it removes it (and the notifications in it)
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS notifications");
    },
};
