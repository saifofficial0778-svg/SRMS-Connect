const { addColumn, dropColumn, addIndex, dropIndex } = require("../scripts/migrationHelpers");

// profile_skills.skill_key / job_skills.skill_key: the normalized form of what was typed (lower
// case, spaces . - _ / removed), computed by MySQL from the `skill` column.
//
// They are VIRTUAL generated columns: no stored data is added or changed, the original text stays
// untouched, and the value can never drift from it. The index is what lets "who has this skill"
// and "which jobs need it" join to skill_aliases without scanning.
//
// This expression must stay identical to normalizeSkillKey() in src/modules/skill/skill.normalize.js.
const KEY_EXPR =
    "LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(`skill`), ' ', ''), '.', ''), '-', ''), '_', ''), '/', ''))";

const TABLES = [
    ["profile_skills", "idx_profile_skills_key", "`skill_key`, `profile_id`"],
    ["job_skills", "idx_job_skills_key", "`skill_key`, `job_id`"],
];

module.exports = {
    async up(conn) {
        for (const [table, index, columns] of TABLES) {
            await addColumn(conn, table, "skill_key", `VARCHAR(100) GENERATED ALWAYS AS (${KEY_EXPR}) VIRTUAL`);
            await addIndex(conn, table, index, columns);
        }
    },
    async down(conn) {
        for (const [table, index] of TABLES) {
            await dropIndex(conn, table, index);
            await dropColumn(conn, table, "skill_key");
        }
    },
};
