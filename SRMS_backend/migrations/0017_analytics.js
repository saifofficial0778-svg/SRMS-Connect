// Personal analytics: who saw my posts, who viewed my profile, how often I appeared in search.
//
// Each table keeps ONE row per (subject, viewer, day) with a small capped counter, so refreshing a
// page cannot inflate the numbers and the tables grow with real activity, not with page loads.
//
//   post_impressions    a post was shown on someone's screen
//                       impressions = SUM(views), people reached = COUNT(DISTINCT viewer_id)
//   profile_views       someone opened a member's profile
//   search_appearances  a member was listed in someone's search results
//
// A person's own views of their own post/profile are never stored (enforced in the service and by
// the CHECK constraints where both ids are in the row).
module.exports = {
    async up(conn) {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS post_impressions (
                id BIGINT NOT NULL AUTO_INCREMENT,
                post_id BIGINT NOT NULL,
                viewer_id BIGINT NOT NULL,
                view_date DATE NOT NULL,
                views TINYINT UNSIGNED NOT NULL DEFAULT 1,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_post_impression_day (post_id, viewer_id, view_date),
                KEY idx_post_impressions_date (post_id, view_date),
                KEY idx_post_impressions_viewer (viewer_id),
                CONSTRAINT fk_post_impressions_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
                CONSTRAINT fk_post_impressions_viewer FOREIGN KEY (viewer_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS profile_views (
                id BIGINT NOT NULL AUTO_INCREMENT,
                profile_user_id BIGINT NOT NULL,
                viewer_id BIGINT NOT NULL,
                view_date DATE NOT NULL,
                views TINYINT UNSIGNED NOT NULL DEFAULT 1,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                last_viewed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_profile_view_day (profile_user_id, viewer_id, view_date),
                KEY idx_profile_views_owner_date (profile_user_id, view_date),
                KEY idx_profile_views_viewer (viewer_id),
                CONSTRAINT fk_profile_views_owner FOREIGN KEY (profile_user_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT fk_profile_views_viewer FOREIGN KEY (viewer_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT chk_profile_view_not_self CHECK (profile_user_id <> viewer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS search_appearances (
                id BIGINT NOT NULL AUTO_INCREMENT,
                user_id BIGINT NOT NULL,
                viewer_id BIGINT NOT NULL,
                appeared_date DATE NOT NULL,
                appearances TINYINT UNSIGNED NOT NULL DEFAULT 1,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_search_appearance_day (user_id, viewer_id, appeared_date),
                KEY idx_search_appearances_user_date (user_id, appeared_date),
                KEY idx_search_appearances_viewer (viewer_id),
                CONSTRAINT fk_search_appearances_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT fk_search_appearances_viewer FOREIGN KEY (viewer_id) REFERENCES users (id) ON DELETE CASCADE,
                CONSTRAINT chk_search_appearance_not_self CHECK (user_id <> viewer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    },
    async down(conn) {
        await conn.query("DROP TABLE IF EXISTS search_appearances");
        await conn.query("DROP TABLE IF EXISTS profile_views");
        await conn.query("DROP TABLE IF EXISTS post_impressions");
    },
};
