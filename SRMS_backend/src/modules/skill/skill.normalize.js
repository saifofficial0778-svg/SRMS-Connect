// The one definition of "the same spelling": lower case, with spaces . - _ / removed.
//   "React.js" -> "reactjs"    "Node JS" -> "nodejs"    "CI/CD" -> "cicd"    "C++" -> "c++"
//
// This must stay identical to the SQL expression behind the skill_key columns (migration 0013);
// a test compares the two against the real database's behaviour for a list of spellings.
function normalizeSkillKey(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[ ._\-/]/g, "");
}

module.exports = { normalizeSkillKey };
