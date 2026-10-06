const pool = require("../../config/db");

const SkillRepository = {

    // every known spelling with the canonical skill it means (a few hundred rows at most)
    async findAllAliases() {
        const [rows] = await pool.execute(
            `
            SELECT sa.alias_key, s.slug, s.name
            FROM skill_aliases sa
            JOIN skills s ON s.id = sa.skill_id
            `
        );
        return rows;
    },
};

module.exports = SkillRepository;
