// Pure SQL-fragment builder for the job listing (no DB access, so it is unit-testable).
// Reuses the search module's LIKE escaping and term splitting; every value is a bound parameter.
const { escapeLike, splitTerms } = require("../search/search.queryBuilder");
const { normalizeSkillKey } = require("../skill/skill.normalize");

// Public listing: only OPEN jobs whose poster is still an ACTIVE alumnus.
// "mine": the viewer's own non-deleted jobs (open and closed), nobody else's.
function buildJobFilter({ viewerId, mine, status, q, company, location, jobType, experience, skills, skillKeyGroups }) {
    const where = [];
    const params = [];

    if (mine) {
        where.push("j.poster_id = ?");
        params.push(viewerId);
        if (status) {
            where.push("j.status = ?");
            params.push(status);
        } else {
            where.push("j.status IN ('OPEN', 'CLOSED')");
        }
    } else {
        where.push("j.status = 'OPEN' AND u.status = 'ACTIVE' AND u.role = 'ALUMNI'");
    }

    // every word must appear in the title, company, location, description or start a required skill
    for (const term of splitTerms(q)) {
        const contains = `%${escapeLike(term)}%`;
        where.push(
            `(j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ? OR j.description LIKE ?
              OR EXISTS (SELECT 1 FROM job_skills js WHERE js.job_id = j.id AND js.skill LIKE ?))`
        );
        params.push(contains, contains, contains, contains, `${escapeLike(term)}%`);
    }

    if (company) {
        where.push("j.company LIKE ?");
        params.push(`%${escapeLike(company)}%`);
    }
    if (location) {
        where.push("j.location LIKE ?");
        params.push(`%${escapeLike(location)}%`);
    }
    if (jobType) {
        where.push("j.job_type = ?");
        params.push(jobType);
    }
    if (experience !== undefined && experience !== null) {
        where.push("j.experience_min <= ? AND (j.experience_max IS NULL OR j.experience_max >= ?)");
        params.push(experience, experience);
    }
    // Every requested skill must be required by the job. Each skill is a group of spelling keys that
    // mean the same thing (resolved by the service), matched on the indexed skill_key.
    const groups = skillKeyGroups || (skills || []).map((skill) => [normalizeSkillKey(skill)]);
    for (const keys of groups) {
        where.push(
            `EXISTS (SELECT 1 FROM job_skills js WHERE js.job_id = j.id AND js.skill_key IN (${keys.map(() => "?").join(", ")}))`
        );
        params.push(...keys);
    }

    return { whereSql: where.join(" AND "), params };
}

module.exports = { buildJobFilter };
