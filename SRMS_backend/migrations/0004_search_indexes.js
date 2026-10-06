const { addIndex, dropIndex, indexExists } = require("../scripts/migrationHelpers");

// [table, index name, columns]
const BTREE_INDEXES = [
    // directory always restricts to ACTIVE students/alumni first
    ["users", "idx_users_role_status", "`role`, `status`"],
    // name prefix search and ordering
    ["profiles", "idx_profiles_full_name", "`full_name`"],
    // branch + batch filters
    ["profiles", "idx_profiles_branch_batch", "`branch`, `batch_year`"],
    // skill filter / skill prefix search (the existing unique key leads with profile_id)
    ["profile_skills", "idx_profile_skills_skill", "`skill`"],
];

// full-text search over post content (global search -> Posts)
const FULLTEXT_INDEXES = [["posts", "ftx_posts_content", "`content`"]];

module.exports = {
    async up(conn) {
        for (const [table, name, cols] of BTREE_INDEXES) {
            const created = await addIndex(conn, table, name, cols);
            console.log(`   ${created ? "added" : "exists"} ${table}.${name}`);
        }
        for (const [table, name, cols] of FULLTEXT_INDEXES) {
            if (await indexExists(conn, table, name)) {
                console.log(`   exists ${table}.${name}`);
                continue;
            }
            await conn.query(`ALTER TABLE \`${table}\` ADD FULLTEXT INDEX \`${name}\` (${cols})`);
            console.log(`   added ${table}.${name}`);
        }
    },
    async down(conn) {
        for (const [table, name] of FULLTEXT_INDEXES) await dropIndex(conn, table, name);
        for (const [table, name] of BTREE_INDEXES) await dropIndex(conn, table, name);
    },
};
