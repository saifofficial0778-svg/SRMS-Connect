const { addIndex, dropIndex } = require("../scripts/migrationHelpers");

// [table, index name, columns]
const INDEXES = [
    // feed: filters on status/deleted_at and orders by created_at
    ["posts", "idx_posts_feed", "`status`, `deleted_at`, `created_at`"],
    ["posts", "idx_posts_user_created", "`user_id`, `created_at`"],
    // comments listing per post, oldest first
    ["post_comments", "idx_post_comments_post_created", "`post_id`, `created_at`"],
    // message history pagination and last-message lookup
    ["messages", "idx_messages_conversation_created", "`conversation_id`, `created_at`, `id`"],
    // connection lists / feed scoring
    ["connections", "idx_connections_receiver_status", "`receiver_id`, `status`"],
    ["connections", "idx_connections_sender_status", "`sender_id`, `status`"],
    // auth middleware looks sessions up by token hash on every request
    ["user_sessions", "idx_sessions_token_hash", "`token_hash`"],
    ["user_sessions", "idx_sessions_expires_at", "`expires_at`"],
    // OTP verification lookup
    ["otp_verifications", "idx_otp_lookup", "`user_id`, `purpose`, `is_used`, `expires_at`"],
    ["password_resets", "idx_password_resets_token_hash", "`token_hash`"],
];

module.exports = {
    async up(conn) {
        for (const [table, name, cols] of INDEXES) {
            const created = await addIndex(conn, table, name, cols);
            console.log(`   ${created ? "added" : "exists"} ${table}.${name}`);
        }
    },
    async down(conn) {
        for (const [table, name] of INDEXES) {
            await dropIndex(conn, table, name);
        }
    },
};
