const { addColumn, dropColumn, addIndex, dropIndex } = require("../scripts/migrationHelpers");

// connections:
//   Only one *live* (PENDING/ACCEPTED) row may exist per unordered user pair, regardless of
//   who sent it. Dead rows (REJECTED/CANCELLED/REMOVED) are kept as history and do not block a
//   fresh request - `live_flag` is NULL for them and NULLs never collide in a UNIQUE index.
// conversations:
//   (A,B) and (B,A) must be the same conversation: unique on LEAST/GREATEST of the pair.
//
// Existing data is never modified. If duplicates already exist the migration aborts with a list
// so they can be resolved by hand first.

async function assertNoDuplicates(conn, sql, label) {
    const [rows] = await conn.query(sql);
    if (rows.length) {
        throw new Error(
            `Cannot add ${label}: duplicate pairs already exist ` +
                `(${rows.map((r) => `${r.low}-${r.high} x${r.n}`).join(", ")}). Resolve them manually and re-run.`
        );
    }
}

module.exports = {
    async up(conn) {
        await assertNoDuplicates(
            conn,
            `SELECT LEAST(sender_id, receiver_id) AS low, GREATEST(sender_id, receiver_id) AS high, COUNT(*) AS n
             FROM connections WHERE status IN ('PENDING','ACCEPTED')
             GROUP BY low, high HAVING n > 1`,
            "unique live connection per pair"
        );
        await assertNoDuplicates(
            conn,
            `SELECT LEAST(user_one_id, user_two_id) AS low, GREATEST(user_one_id, user_two_id) AS high, COUNT(*) AS n
             FROM conversations GROUP BY low, high HAVING n > 1`,
            "unique conversation per pair"
        );

        await addColumn(conn, "connections", "pair_low", "BIGINT GENERATED ALWAYS AS (LEAST(`sender_id`, `receiver_id`)) VIRTUAL");
        await addColumn(conn, "connections", "pair_high", "BIGINT GENERATED ALWAYS AS (GREATEST(`sender_id`, `receiver_id`)) VIRTUAL");
        await addColumn(
            conn,
            "connections",
            "live_flag",
            "TINYINT GENERATED ALWAYS AS (IF(`status` IN ('PENDING','ACCEPTED'), 1, NULL)) VIRTUAL"
        );
        await addIndex(conn, "connections", "uq_connections_live_pair", "`pair_low`, `pair_high`, `live_flag`", { unique: true });

        await addColumn(conn, "conversations", "pair_low", "BIGINT GENERATED ALWAYS AS (LEAST(`user_one_id`, `user_two_id`)) VIRTUAL");
        await addColumn(conn, "conversations", "pair_high", "BIGINT GENERATED ALWAYS AS (GREATEST(`user_one_id`, `user_two_id`)) VIRTUAL");
        await addIndex(conn, "conversations", "uq_conversations_pair", "`pair_low`, `pair_high`", { unique: true });
    },

    async down(conn) {
        await dropIndex(conn, "conversations", "uq_conversations_pair");
        await dropColumn(conn, "conversations", "pair_high");
        await dropColumn(conn, "conversations", "pair_low");
        await dropIndex(conn, "connections", "uq_connections_live_pair");
        await dropColumn(conn, "connections", "live_flag");
        await dropColumn(conn, "connections", "pair_high");
        await dropColumn(conn, "connections", "pair_low");
    },
};
