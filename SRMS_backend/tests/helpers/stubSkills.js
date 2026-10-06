// Skill comparisons go through SkillService, which loads the alias table from the database.
// Tests use this small in-memory alias table instead, so they never touch the real database.
const SkillRepository = require("../../src/modules/skill/skill.repository");
const SkillService = require("../../src/modules/skill/skill.service");

const DEFAULT_ALIASES = [
    { alias_key: "react", slug: "react", name: "React" },
    { alias_key: "reactjs", slug: "react", name: "React" },
    { alias_key: "nodejs", slug: "nodejs", name: "Node.js" },
    { alias_key: "node", slug: "nodejs", name: "Node.js" },
    { alias_key: "javascript", slug: "javascript", name: "JavaScript" },
    { alias_key: "js", slug: "javascript", name: "JavaScript" },
    { alias_key: "es6", slug: "javascript", name: "JavaScript" },
];

module.exports = function stubSkills(mock, aliases = DEFAULT_ALIASES) {
    SkillService.resetCache();
    return mock.method(SkillRepository, "findAllAliases", async () => aliases);
};
module.exports.DEFAULT_ALIASES = DEFAULT_ALIASES;
