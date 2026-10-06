// Pure SQL-fragment builders for search (no DB access, so they are unit-testable).
// Every user-supplied value goes through a placeholder; LIKE wildcards in input are escaped.

// words InnoDB ignores in full-text indexes - a "+word*" on one of these would match nothing
const FT_STOPWORDS = new Set([
    "a", "about", "an", "are", "as", "at", "be", "by", "com", "de", "en", "for", "from", "how", "i", "in",
    "is", "it", "la", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "where", "who",
    "will", "with", "und", "www",
]);
const FT_MIN_TOKEN = 3; // innodb_ft_min_token_size default

const { normalizeSkillKey } = require("../skill/skill.normalize");

const MAX_TERMS = 5;

const escapeLike = (s) => s.replace(/[\\%_]/g, "\\$&");

// "  Sai   Kumar " -> ["Sai", "Kumar"]
function splitTerms(q) {
    if (!q) return [];
    return q.trim().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

// ---------- people ----------

// Only ACTIVE students/alumni are ever searchable, and never the person searching.
const PEOPLE_BASE_WHERE = "u.status = 'ACTIVE' AND u.role IN ('STUDENT', 'ALUMNI') AND p.user_id <> ?";

function buildPeopleFilter({ viewerId, q, role, company, designation, branch, batch, skills, skillKeyGroups, openTo }) {
    const where = [PEOPLE_BASE_WHERE];
    const params = [viewerId];

    // every word must match name, company, designation or a skill
    for (const term of splitTerms(q)) {
        const contains = `%${escapeLike(term)}%`;
        where.push(
            `(p.full_name LIKE ? OR p.company LIKE ? OR p.designation LIKE ?
              OR EXISTS (SELECT 1 FROM profile_skills ps WHERE ps.profile_id = p.id AND ps.skill LIKE ?))`
        );
        params.push(contains, contains, contains, `${escapeLike(term)}%`);
    }

    if (role) {
        where.push("u.role = ?");
        params.push(role);
    }
    if (company) {
        where.push("p.company LIKE ?");
        params.push(`%${escapeLike(company)}%`);
    }
    if (designation) {
        where.push("p.designation LIKE ?");
        params.push(`%${escapeLike(designation)}%`);
    }
    if (branch) {
        where.push("p.branch = ?");
        params.push(branch);
    }
    if (batch) {
        where.push("p.batch_year = ?");
        params.push(batch);
    }
    if (openTo) {
        where.push("EXISTS (SELECT 1 FROM profile_open_to po WHERE po.profile_id = p.id AND po.intent = ?)");
        params.push(openTo);
    }
    // All requested skills must be present. Each skill is a group of spelling keys that mean the
    // same thing (resolved by the service from the alias table), matched on the indexed skill_key;
    // without a resolved group, the skill's own normalized key is used.
    const groups = skillKeyGroups || (skills || []).map((skill) => [normalizeSkillKey(skill)]);
    for (const keys of groups) {
        where.push(
            `EXISTS (SELECT 1 FROM profile_skills ps WHERE ps.profile_id = p.id AND ps.skill_key IN (${keys.map(() => "?").join(", ")}))`
        );
        params.push(...keys);
    }

    return { whereSql: where.join(" AND "), params };
}

// Name matches first (starts-with, then word-starts-with), then everything else alphabetically.
function buildPeopleOrder(q) {
    const term = splitTerms(q)[0];
    if (!term) {
        return { orderSql: "p.full_name ASC, p.user_id ASC", params: [] };
    }
    const safe = escapeLike(term);
    return {
        orderSql: `CASE WHEN p.full_name LIKE ? THEN 0 WHEN p.full_name LIKE ? THEN 1 ELSE 2 END ASC,
                   p.full_name ASC, p.user_id ASC`,
        params: [`${safe}%`, `% ${safe}%`],
    };
}

// ---------- posts ----------

// Boolean-mode full-text query: every word required, prefix-matched ("+intern* +googl*").
function toBooleanQuery(terms) {
    return terms
        .map((t) => t.replace(/[^\p{L}\p{N}_]/gu, ""))
        .filter(Boolean)
        .map((t) => `+${t}*`)
        .join(" ");
}

function canUseFullText(terms) {
    return (
        terms.length > 0 &&
        terms.every((t) => t.replace(/[^\p{L}\p{N}_]/gu, "").length >= FT_MIN_TOKEN && !FT_STOPWORDS.has(t.toLowerCase()))
    );
}

function buildPostFilter(q) {
    const terms = splitTerms(q);
    const base = "po.status = 'ACTIVE' AND po.deleted_at IS NULL AND u.status = 'ACTIVE'";

    if (canUseFullText(terms)) {
        return { whereSql: `${base} AND MATCH(po.content) AGAINST (? IN BOOLEAN MODE)`, params: [toBooleanQuery(terms)] };
    }
    // short words / stopwords can't be served by the full-text index - fall back to LIKE
    const likes = terms.map(() => "po.content LIKE ?");
    return {
        whereSql: [base, ...likes].join(" AND "),
        params: terms.map((t) => `%${escapeLike(t)}%`),
    };
}

module.exports = {
    escapeLike,
    splitTerms,
    buildPeopleFilter,
    buildPeopleOrder,
    buildPostFilter,
    toBooleanQuery,
    canUseFullText,
};
