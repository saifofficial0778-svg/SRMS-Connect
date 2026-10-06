const InsightRepository = require("./insight.repository");

const TOP_N = 10;
const TREND_DAYS = 30;
const MAX_JOBS_FOR_GAP = 300;
const PULSE_CACHE_MS = 60 * 1000; // the pulse is the same for everyone, so compute it at most once a minute

const DATA_SOURCE =
    "Counted only from profiles and job posts on SRMS Connect. This is not external job-market data.";
const GAP_RULE =
    "Skills are ranked by how many of the matching open jobs ask for them. Ties are broken by how many SRMS alumni list the skill, then alphabetically.";

const share = (count, base) => (base > 0 ? Math.round((count / base) * 1000) / 10 : 0); // percent, 1 decimal

// ---------- Industry Pulse ----------

// rows of { skill_key, skill, total } -> [{ skill, skill_key, count, share }]
const toRanked = (rows, base) =>
    rows.map((r) => ({ skill: r.skill, skill_key: r.skill_key, count: Number(r.total), share: share(Number(r.total), base) }));

// rows of { skill_key, skill, recent, previous } -> trend entries, most posted recently first
function toTrend(rows) {
    return rows.map((r) => {
        const recent = Number(r.recent);
        const previous = Number(r.previous);
        return {
            skill: r.skill,
            skill_key: r.skill_key,
            recent,
            previous,
            change: recent - previous,
            // "new" = asked for now but not at all in the period before
            direction: previous === 0 ? "new" : recent > previous ? "up" : recent < previous ? "down" : "flat",
        };
    });
}

let pulseCache = null;

// ---------- Skill Gap ----------

// Pure: turns "jobs + the skills they ask for + what the viewer has" into a ranked gap report.
// Kept free of DB access so the ranking rule can be tested directly.
function computeSkillGap({ jobs, jobSkillRows, viewerSkills, alumniCounts }) {
    const have = new Map(viewerSkills.map((s) => [s.skill_key, s.skill]));
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    // skills per job (a job listing one skill under two spellings still counts once)
    const skillsByJob = new Map();
    const names = new Map();
    for (const row of jobSkillRows) {
        if (!jobById.has(row.job_id)) continue;
        if (!skillsByJob.has(row.job_id)) skillsByJob.set(row.job_id, new Set());
        skillsByJob.get(row.job_id).add(row.skill_key);
        if (!names.has(row.skill_key)) names.set(row.skill_key, row.skill);
    }

    // demand: which jobs ask for each skill
    const jobsBySkill = new Map();
    for (const [jobId, keys] of skillsByJob) {
        for (const key of keys) {
            if (!jobsBySkill.has(key)) jobsBySkill.set(key, []);
            jobsBySkill.get(key).push(jobId);
        }
    }

    const jobsWithSkills = skillsByJob.size;
    const entries = [...jobsBySkill.entries()].map(([key, jobIds]) => ({
        skill: names.get(key),
        skill_key: key,
        jobs_requiring: jobIds.length,
        share_of_jobs: share(jobIds.length, jobsWithSkills),
        alumni_with_skill: alumniCounts.get(key) || 0,
        example_jobs: jobIds.slice(0, 3).map((id) => {
            const j = jobById.get(id);
            return { id: j.id, title: j.title, company: j.company };
        }),
    }));

    // the ranking rule (see GAP_RULE): demand, then alumni who have it, then name
    const rank = (a, b) =>
        b.jobs_requiring - a.jobs_requiring || b.alumni_with_skill - a.alumni_with_skill || a.skill.localeCompare(b.skill);

    const missing = entries.filter((e) => !have.has(e.skill_key)).sort(rank);
    const matched = entries.filter((e) => have.has(e.skill_key)).sort(rank);

    // coverage: of all the skill requirements across these jobs, how many the viewer already meets
    const totalRequirements = entries.reduce((sum, e) => sum + e.jobs_requiring, 0);
    const metRequirements = matched.reduce((sum, e) => sum + e.jobs_requiring, 0);

    // per job: how much of what it asks for the viewer has
    const jobMatches = [...skillsByJob.entries()]
        .map(([jobId, keys]) => {
            const j = jobById.get(jobId);
            const required = [...keys];
            const missingHere = required.filter((k) => !have.has(k));
            return {
                id: j.id,
                title: j.title,
                company: j.company,
                job_type: j.job_type,
                required: required.length,
                matched: required.length - missingHere.length,
                match_percent: share(required.length - missingHere.length, required.length),
                missing: missingHere.map((k) => names.get(k)),
            };
        })
        .sort((a, b) => b.match_percent - a.match_percent || b.matched - a.matched || a.title.localeCompare(b.title));

    return {
        summary: {
            jobs_considered: jobs.length,
            jobs_with_skills: jobsWithSkills,
            your_skills: have.size,
            demanded_skills: entries.length,
            matched_skills: matched.length,
            missing_skills: missing.length,
            requirements_total: totalRequirements,
            requirements_met: metRequirements,
            coverage_percent: share(metRequirements, totalRequirements),
        },
        missing,
        matched,
        job_matches: jobMatches.slice(0, 5),
    };
}

const InsightService = {

    // Aggregate, platform-wide numbers. Identical for every viewer, so cached briefly.
    async getIndustryPulse() {
        if (pulseCache && Date.now() - pulseCache.at < PULSE_CACHE_MS) return pulseCache.data;

        const [totals, alumniSkills, demand, companies, roles, jobTypes, trend] = await Promise.all([
            InsightRepository.getTotals(),
            InsightRepository.alumniSkillCounts(TOP_N),
            InsightRepository.jobSkillDemand(TOP_N),
            InsightRepository.topCompanies(TOP_N),
            InsightRepository.topRoles(TOP_N),
            InsightRepository.jobTypeCounts(),
            InsightRepository.skillPostingTrend(TREND_DAYS, TOP_N),
        ]);

        const alumniBase = Number(totals.alumni_with_skills);
        const jobBase = Number(totals.open_jobs_with_skills);
        const openJobs = Number(totals.open_jobs);

        const data = {
            generated_at: new Date().toISOString(),
            data_source: DATA_SOURCE,
            totals: {
                alumni: Number(totals.alumni),
                alumni_with_skills: alumniBase,
                open_jobs: openJobs,
                open_jobs_with_skills: jobBase,
            },
            // share = % of alumni who list at least one skill
            alumni_skills: toRanked(alumniSkills, alumniBase),
            // share = % of open jobs that list at least one skill
            demanded_skills: toRanked(demand, jobBase),
            top_companies: companies.map((c) => ({ company: c.company, open_jobs: Number(c.total), share: share(Number(c.total), openJobs) })),
            top_roles: roles.map((r) => ({ title: r.title, open_jobs: Number(r.total), share: share(Number(r.total), openJobs) })),
            job_types: jobTypes.map((t) => ({ job_type: t.job_type, open_jobs: Number(t.total), share: share(Number(t.total), openJobs) })),
            trending_skills: {
                window_days: TREND_DAYS,
                basis: `Jobs posted on SRMS Connect in the last ${TREND_DAYS} days, compared with the ${TREND_DAYS} days before.`,
                skills: toTrend(trend),
            },
        };

        pulseCache = { at: Date.now(), data };
        return data;
    },

    // The signed-in user's own skills against the jobs currently listed. Nobody else's data is
    // involved beyond platform-wide counts.
    async getSkillGap(viewer, { job_type: jobType, role } = {}) {
        const [jobs, viewerSkills, alumniRows] = await Promise.all([
            InsightRepository.findListedJobs({ jobType, role }, MAX_JOBS_FOR_GAP),
            InsightRepository.viewerSkills(viewer.userId),
            InsightRepository.alumniSkillCounts(null),
        ]);
        const jobSkillRows = await InsightRepository.findSkillsForJobs(jobs.map((j) => j.id));

        const report = computeSkillGap({
            jobs,
            jobSkillRows,
            viewerSkills,
            alumniCounts: new Map(alumniRows.map((r) => [r.skill_key, Number(r.total)])),
        });

        return {
            generated_at: new Date().toISOString(),
            data_source: DATA_SOURCE,
            ranking_rule: GAP_RULE,
            filters: { job_type: jobType || null, role: role || null },
            your_skills: viewerSkills.map((s) => s.skill),
            ...report,
        };
    },

    resetCache() {
        pulseCache = null;
    },
};

module.exports = InsightService;
module.exports.computeSkillGap = computeSkillGap;
module.exports.toTrend = toTrend;
