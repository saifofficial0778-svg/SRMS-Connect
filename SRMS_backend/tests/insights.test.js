process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const { normalizeSkillKey } = require("../src/modules/skill/skill.normalize");
const SkillRepository = require("../src/modules/skill/skill.repository");
const SkillService = require("../src/modules/skill/skill.service");
const InsightRepository = require("../src/modules/insight/insight.repository");
const InsightService = require("../src/modules/insight/insight.service");
const { computeSkillGap, toTrend } = InsightService;
const { skillGapQuerySchema } = require("../src/modules/insight/insight.validation");
const insightRoutes = require("../src/modules/insight/insight.route");
const searchQb = require("../src/modules/search/search.queryBuilder");
const { buildJobFilter } = require("../src/modules/job/job.queryBuilder");
const ProfileRepository = require("../src/modules/profile/profile.repository");
const ProfileService = require("../src/modules/profile/profile.service");
const JobRepository = require("../src/modules/job/job.repository");
const JobService = require("../src/modules/job/job.service");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const stubNotifications = require("./helpers/stubNotifications");
const stubSkills = require("./helpers/stubSkills");

let aliasLoads;
beforeEach(() => {
    stubNotifications(mock);
    aliasLoads = stubSkills(mock);
    InsightService.resetCache();
});
afterEach(() => mock.restoreAll());

// ======================= skill normalization =======================

test("normalizeSkillKey: case, spaces and . - _ / are ignored; meaningful symbols are kept", () => {
    const same = (list) => new Set(list.map(normalizeSkillKey)).size === 1;
    assert.equal(same(["React.js", "ReactJS", "react js", "REACT-JS", " react_js "]), true);
    assert.equal(same(["Node.js", "NodeJS", "node js", "node-js"]), true);
    assert.equal(same(["CI/CD", "cicd", "CI CD", "ci-cd"]), true);
    assert.equal(normalizeSkillKey("C++"), "c++"); // + and # distinguish real skills
    assert.equal(normalizeSkillKey("C#"), "c#");
    assert.notEqual(normalizeSkillKey("C"), normalizeSkillKey("C++"));
    assert.notEqual(normalizeSkillKey("Java"), normalizeSkillKey("JavaScript"));
    assert.equal(normalizeSkillKey(""), "");
    assert.equal(normalizeSkillKey(null), "");
});

test("variants resolve to one canonical skill; unknown skills stand for themselves", async () => {
    assert.deepEqual(await SkillService.canonicalize("React.js"), { key: "react", name: "React" });
    assert.deepEqual(await SkillService.canonicalize("REACT"), { key: "react", name: "React" });
    assert.deepEqual(await SkillService.canonicalize("Node"), { key: "nodejs", name: "Node.js" });
    assert.deepEqual(await SkillService.canonicalize("node-js"), { key: "nodejs", name: "Node.js" });
    assert.deepEqual(await SkillService.canonicalize("JS"), { key: "javascript", name: "JavaScript" });
    assert.deepEqual(await SkillService.canonicalize(" Solidity "), { key: "solidity", name: "Solidity" });
});

test("equivalentKeys returns every spelling of the same skill", async () => {
    assert.deepEqual((await SkillService.equivalentKeys("React")).sort(), ["react", "reactjs"]);
    assert.deepEqual((await SkillService.equivalentKeys("react.js")).sort(), ["react", "reactjs"]);
    assert.deepEqual((await SkillService.equivalentKeys("js")).sort(), ["es6", "javascript", "js"]);
    assert.deepEqual(await SkillService.equivalentKeys("Solidity"), ["solidity"]);
});

test("dedupe keeps the first spelling of each skill and drops later variants", async () => {
    assert.deepEqual(await SkillService.dedupe(["React", "React.js", "Node", "NodeJS", "Solidity", "solidity", "JS"]), ["React", "Node", "Solidity", "JS"]);
    assert.deepEqual(await SkillService.dedupe([]), []);
    assert.deepEqual(await SkillService.dedupe(undefined), []);
});

test("the alias table is loaded once and reused, not queried per comparison", async () => {
    await SkillService.canonicalize("React");
    await SkillService.equivalentKeys("Node");
    await SkillService.dedupe(["a", "b", "c"]);
    assert.equal(aliasLoads.mock.callCount(), 1);

    SkillService.resetCache();
    await SkillService.canonicalize("React");
    assert.equal(aliasLoads.mock.callCount(), 2);
});

test("skill filters match on the normalized key, with every equivalent spelling bound as a parameter", () => {
    const people = searchQb.buildPeopleFilter({ viewerId: 1, skillKeyGroups: [["react", "reactjs"], ["nodejs", "node"]] });
    assert.equal((people.whereSql.match(/ps\.skill_key IN \(\?, \?\)/g) || []).length, 2);
    assert.deepEqual(people.params, [1, "react", "reactjs", "nodejs", "node"]);

    const jobs = buildJobFilter({ viewerId: 1, skillKeyGroups: [["javascript", "js", "es6"]] });
    assert.match(jobs.whereSql, /js\.skill_key IN \(\?, \?, \?\)/);
    assert.deepEqual(jobs.params, ["javascript", "js", "es6"]);

    // without resolved groups, the skill's own normalized key is used (never the raw text)
    const raw = searchQb.buildPeopleFilter({ viewerId: 1, skills: ["React.JS"] });
    assert.deepEqual(raw.params, [1, "reactjs"]);
    assert.equal(raw.whereSql.includes("React.JS"), false);
});

test("adding a different spelling of a skill you already list is refused", async () => {
    mock.method(ProfileRepository, "findProfileByUserId", async () => ({ id: 40, user_id: 1, skills: [{ id: 1, skill: "React.js" }, { id: 2, skill: "Solidity" }] }));
    mock.method(ProfileRepository, "findSkill", async () => undefined); // not an exact duplicate
    const create = mock.method(ProfileRepository, "createSkill", async () => 9);

    await assert.rejects(ProfileService.addSkill(1, "React"), (e) => e.statusCode === 409 && /listed as "React\.js"/.test(e.message));
    await assert.rejects(ProfileService.addSkill(1, "ReactJS"), { statusCode: 409 });
    await assert.rejects(ProfileService.addSkill(1, "SOLIDITY"), { statusCode: 409 });
    assert.equal(create.mock.callCount(), 0);

    assert.equal(await ProfileService.addSkill(1, "Node"), 9); // a genuinely new skill, kept as typed
    assert.deepEqual(create.mock.calls[0].arguments, [40, "Node"]);
});

test("a job's skill list is de-duplicated across spellings before it is stored", async () => {
    mock.method(JobRepository, "countOpenByPoster", async () => 0);
    const create = mock.method(JobRepository, "createJob", async () => 5);

    await JobService.createJob({ userId: 10, role: "ALUMNI" }, { title: "Dev", company: "Acme", skills: ["React", "react.js", "Node.js", "node"] });

    assert.deepEqual(create.mock.calls[0].arguments[1].skills, ["React", "Node.js"]);
});

// ======================= skill gap: aggregation and ranking =======================

const jobs = [
    { id: 1, title: "Backend Engineer", company: "Acme", job_type: "FULL_TIME" },
    { id: 2, title: "Frontend Engineer", company: "Acme", job_type: "FULL_TIME" },
    { id: 3, title: "Backend Intern", company: "Globex", job_type: "INTERNSHIP" },
    { id: 4, title: "No skills listed", company: "Initech", job_type: "CONTRACT" },
];
const s = (job_id, skill_key, skill) => ({ job_id, skill_key, skill });
const jobSkillRows = [
    s(1, "react", "React"), s(1, "nodejs", "Node.js"), s(1, "sql", "SQL"),
    s(2, "react", "React"), s(2, "typescript", "TypeScript"), s(2, "docker", "Docker"),
    s(3, "javascript", "JavaScript"), s(3, "nodejs", "Node.js"), s(3, "aws", "AWS"),
];
const gapInput = (over = {}) => ({
    jobs,
    jobSkillRows,
    viewerSkills: [{ skill_key: "react", skill: "React" }, { skill_key: "javascript", skill: "JavaScript" }],
    alumniCounts: new Map([["nodejs", 4], ["aws", 3], ["sql", 3], ["docker", 1]]),
    ...over,
});

test("missing skills are ranked by job demand, then by alumni who have them, then by name", () => {
    const { missing } = computeSkillGap(gapInput());

    assert.deepEqual(missing.map((m) => [m.skill, m.jobs_requiring, m.alumni_with_skill]), [
        ["Node.js", 2, 4], // asked for by the most jobs
        ["AWS", 1, 3], // tie on demand (1) and on alumni (3): alphabetical
        ["SQL", 1, 3],
        ["Docker", 1, 1],
        ["TypeScript", 1, 0],
    ]);
    assert.equal(missing[0].share_of_jobs, 66.7); // 2 of the 3 jobs that list skills
    assert.deepEqual(missing[0].example_jobs, [
        { id: 1, title: "Backend Engineer", company: "Acme" },
        { id: 3, title: "Backend Intern", company: "Globex" },
    ]);
});

test("skills you already have are reported as matched, never as gaps", () => {
    const { matched, missing } = computeSkillGap(gapInput());
    assert.deepEqual(matched.map((m) => [m.skill, m.jobs_requiring]), [["React", 2], ["JavaScript", 1]]);
    assert.equal(missing.some((m) => ["React", "JavaScript"].includes(m.skill)), false);
});

test("summary counts and coverage are plain arithmetic over the jobs considered", () => {
    const { summary } = computeSkillGap(gapInput());
    assert.deepEqual(summary, {
        jobs_considered: 4,
        jobs_with_skills: 3, // one job lists no skills and can't contribute
        your_skills: 2,
        demanded_skills: 7,
        matched_skills: 2,
        missing_skills: 5,
        requirements_total: 9, // 3 jobs x 3 skills
        requirements_met: 3, // React x2 + JavaScript x1
        coverage_percent: 33.3,
    });
});

test("per-job match: best fits first, with what is still missing", () => {
    const { job_matches: matches } = computeSkillGap(gapInput({ viewerSkills: [{ skill_key: "react", skill: "React" }, { skill_key: "nodejs", skill: "Node.js" }, { skill_key: "sql", skill: "SQL" }] }));
    assert.deepEqual(matches.map((m) => [m.title, m.matched, m.required, m.match_percent, m.missing]), [
        ["Backend Engineer", 3, 3, 100, []],
        ["Backend Intern", 1, 3, 33.3, ["JavaScript", "AWS"]],
        ["Frontend Engineer", 1, 3, 33.3, ["TypeScript", "Docker"]],
    ]);
    assert.equal(matches.some((m) => m.title === "No skills listed"), false);
});

test("a skill listed twice by one job (two spellings) counts once", () => {
    const { missing } = computeSkillGap(gapInput({ jobSkillRows: [s(1, "nodejs", "Node.js"), s(1, "nodejs", "Node"), s(3, "nodejs", "Node.js")], viewerSkills: [] }));
    assert.equal(missing[0].jobs_requiring, 2);
    assert.equal(missing[0].skill, "Node.js");
});

test("no jobs, no skills on the profile, and rows for jobs outside the filter are all handled", () => {
    const empty = computeSkillGap(gapInput({ jobs: [], jobSkillRows: [] }));
    assert.deepEqual(empty.missing, []);
    assert.equal(empty.summary.coverage_percent, 0); // not NaN
    assert.equal(Number.isNaN(empty.summary.coverage_percent), false);

    const noProfileSkills = computeSkillGap(gapInput({ viewerSkills: [] }));
    assert.equal(noProfileSkills.summary.matched_skills, 0);
    assert.equal(noProfileSkills.summary.missing_skills, 7);

    const filtered = computeSkillGap(gapInput({ jobs: [jobs[2]] })); // only the intern job is in scope
    assert.deepEqual(filtered.missing.map((m) => m.skill).sort(), ["AWS", "Node.js"]);
    assert.equal(filtered.summary.jobs_with_skills, 1);
});

test("the gap report has no people in it", () => {
    const json = JSON.stringify(computeSkillGap(gapInput()));
    for (const field of ["user_id", "full_name", "email", "enrollment", "profile_photo", "poster"]) {
        assert.equal(json.includes(field), false, field);
    }
});

// ======================= industry pulse =======================

test("trend direction comes straight from the two counts", () => {
    const rows = [
        { skill_key: "a", skill: "A", recent: 3, previous: 0 },
        { skill_key: "b", skill: "B", recent: "4", previous: "2" }, // MySQL may return strings
        { skill_key: "c", skill: "C", recent: 1, previous: 5 },
        { skill_key: "d", skill: "D", recent: 2, previous: 2 },
    ];
    assert.deepEqual(toTrend(rows).map((t) => [t.skill, t.recent, t.previous, t.change, t.direction]), [
        ["A", 3, 0, 3, "new"],
        ["B", 4, 2, 2, "up"],
        ["C", 1, 5, -4, "down"],
        ["D", 2, 2, 0, "flat"],
    ]);
});

function stubPulse(over = {}) {
    const data = {
        getTotals: { alumni: 20, alumni_with_skills: 10, open_jobs: 8, open_jobs_with_skills: 4 },
        alumniSkillCounts: [{ skill_key: "react", skill: "React", total: 5 }, { skill_key: "sql", skill: "SQL", total: "2" }],
        jobSkillDemand: [{ skill_key: "nodejs", skill: "Node.js", total: 3 }],
        topCompanies: [{ company: "Acme", total: 6 }, { company: "Globex", total: 2 }],
        topRoles: [{ title: "Backend Engineer", total: 4 }],
        jobTypeCounts: [{ job_type: "FULL_TIME", total: 6 }, { job_type: "INTERNSHIP", total: 2 }],
        skillPostingTrend: [{ skill_key: "nodejs", skill: "Node.js", recent: 3, previous: 1 }],
        ...over,
    };
    const stubs = {};
    for (const [name, value] of Object.entries(data)) stubs[name] = mock.method(InsightRepository, name, async () => value);
    return stubs;
}

test("industry pulse: counts are passed through with shares of the stated base", async () => {
    stubPulse();
    const pulse = await InsightService.getIndustryPulse();

    assert.deepEqual(pulse.totals, { alumni: 20, alumni_with_skills: 10, open_jobs: 8, open_jobs_with_skills: 4 });
    assert.deepEqual(pulse.alumni_skills, [
        { skill: "React", skill_key: "react", count: 5, share: 50 }, // 5 of the 10 alumni who list skills
        { skill: "SQL", skill_key: "sql", count: 2, share: 20 },
    ]);
    assert.deepEqual(pulse.demanded_skills, [{ skill: "Node.js", skill_key: "nodejs", count: 3, share: 75 }]); // 3 of 4 jobs with skills
    assert.deepEqual(pulse.top_companies, [{ company: "Acme", open_jobs: 6, share: 75 }, { company: "Globex", open_jobs: 2, share: 25 }]);
    assert.deepEqual(pulse.top_roles, [{ title: "Backend Engineer", open_jobs: 4, share: 50 }]);
    assert.deepEqual(pulse.job_types[1], { job_type: "INTERNSHIP", open_jobs: 2, share: 25 });
    assert.equal(pulse.trending_skills.window_days, 30);
    assert.deepEqual(pulse.trending_skills.skills[0], { skill: "Node.js", skill_key: "nodejs", recent: 3, previous: 1, change: 2, direction: "up" });
});

test("industry pulse says where the numbers come from and never claims outside data", async () => {
    stubPulse();
    const pulse = await InsightService.getIndustryPulse();
    assert.match(pulse.data_source, /only from profiles and job posts on SRMS Connect/i);
    assert.match(pulse.data_source, /not external/i);
    assert.match(pulse.trending_skills.basis, /posted on SRMS Connect/);
    assert.ok(pulse.generated_at);
});

test("industry pulse with no data is all zeros and empty lists (no NaN, no made-up rows)", async () => {
    stubPulse({
        getTotals: { alumni: 0, alumni_with_skills: 0, open_jobs: 0, open_jobs_with_skills: 0 },
        alumniSkillCounts: [], jobSkillDemand: [], topCompanies: [], topRoles: [], jobTypeCounts: [], skillPostingTrend: [],
    });
    const pulse = await InsightService.getIndustryPulse();
    assert.deepEqual(pulse.alumni_skills, []);
    assert.deepEqual(pulse.trending_skills.skills, []);
    assert.equal(JSON.stringify(pulse).includes("NaN"), false);
});

test("industry pulse contains only aggregates - no person", async () => {
    stubPulse();
    const json = JSON.stringify(await InsightService.getIndustryPulse());
    for (const field of ["user_id", "full_name", "email", "enrollment", "profile_photo", "poster_id"]) {
        assert.equal(json.includes(field), false, field);
    }
});

test("industry pulse is computed once and then served from a short cache", async () => {
    const stubs = stubPulse();
    await InsightService.getIndustryPulse();
    await InsightService.getIndustryPulse();
    await InsightService.getIndustryPulse();
    assert.equal(stubs.getTotals.mock.callCount(), 1);
    assert.equal(stubs.alumniSkillCounts.mock.callCount(), 1);

    InsightService.resetCache();
    await InsightService.getIndustryPulse();
    assert.equal(stubs.getTotals.mock.callCount(), 2);
});

// ======================= skill gap service: whose data, which filters =======================

test("skill gap uses the signed-in user's skills and the requested filters", async () => {
    const findJobs = mock.method(InsightRepository, "findListedJobs", async () => jobs);
    const viewerSkills = mock.method(InsightRepository, "viewerSkills", async () => [{ skill_key: "react", skill: "React" }]);
    mock.method(InsightRepository, "alumniSkillCounts", async () => [{ skill_key: "nodejs", skill: "Node.js", total: "4" }]);
    const jobSkills = mock.method(InsightRepository, "findSkillsForJobs", async () => jobSkillRows);

    const gap = await InsightService.getSkillGap({ userId: 42, role: "STUDENT" }, { job_type: "INTERNSHIP", role: "backend" });

    assert.deepEqual(viewerSkills.mock.calls[0].arguments, [42]);
    assert.deepEqual(findJobs.mock.calls[0].arguments, [{ jobType: "INTERNSHIP", role: "backend" }, 300]);
    assert.deepEqual(jobSkills.mock.calls[0].arguments, [[1, 2, 3, 4]]);
    assert.deepEqual(gap.filters, { job_type: "INTERNSHIP", role: "backend" });
    assert.deepEqual(gap.your_skills, ["React"]);
    assert.equal(gap.missing[0].skill, "Node.js");
    assert.equal(gap.missing[0].alumni_with_skill, 4);
    assert.match(gap.ranking_rule, /ranked by how many of the matching open jobs ask for them/);
    assert.match(gap.data_source, /not external/i);
});

test("skill gap query: valid filters only, and no way to name another user", () => {
    assert.deepEqual(skillGapQuerySchema.parse({}), {});
    assert.deepEqual(skillGapQuerySchema.parse({ job_type: "INTERNSHIP", role: " backend " }), { job_type: "INTERNSHIP", role: "backend" });
    const blank = skillGapQuerySchema.parse({ job_type: "", role: "" }); // empty form fields mean "no filter"
    assert.equal(blank.job_type, undefined);
    assert.equal(blank.role, undefined);
    assert.equal(skillGapQuerySchema.safeParse({ job_type: "VOLUNTEER" }).success, false);
    assert.equal(skillGapQuerySchema.safeParse({ role: "a" }).success, false);
    assert.equal(skillGapQuerySchema.safeParse({ user_id: "7" }).success, false);
    assert.equal(skillGapQuerySchema.safeParse({ userId: "7" }).success, false);
});

// ======================= the SQL that actually runs =======================

function captureSql() {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql: sql.replace(/\s+/g, " "), params });
        return [[{}], []];
    });
    return calls;
}

test("aggregations count only ACTIVE alumni and currently listed jobs, via the alias table", async () => {
    const calls = captureSql();
    await InsightRepository.alumniSkillCounts(10);
    await InsightRepository.jobSkillDemand(10);
    await InsightRepository.topCompanies(10);
    await InsightRepository.topRoles(10);
    await InsightRepository.jobTypeCounts();
    await InsightRepository.skillPostingTrend(30, 10);

    const [alumni, demand, companies, roles, types, trend] = calls.map((c) => c.sql);
    assert.match(alumni, /u\.status = 'ACTIVE' AND u\.role = 'ALUMNI'/);
    assert.match(alumni, /COUNT\(DISTINCT ps\.profile_id\)/); // a person counts once per skill
    assert.match(alumni, /LEFT JOIN skill_aliases sa ON sa\.alias_key = ps\.skill_key/);
    assert.match(alumni, /LIMIT 10/);
    for (const sql of [demand, companies, roles, types]) {
        assert.match(sql, /j\.status = 'OPEN' AND u\.status = 'ACTIVE' AND u\.role = 'ALUMNI'/);
    }
    assert.match(demand, /COUNT\(DISTINCT js\.job_id\)/);
    assert.match(trend, /j\.status <> 'DELETED'/);
    assert.match(trend, /INTERVAL 30 DAY/);
    assert.match(trend, /INTERVAL 60 DAY/);
    assert.match(trend, /HAVING recent > 0/);
});

test("analytics queries select no personal columns", async () => {
    const calls = captureSql();
    await InsightRepository.getTotals();
    await InsightRepository.alumniSkillCounts(null);
    await InsightRepository.jobSkillDemand(10);
    await InsightRepository.topCompanies(10);
    await InsightRepository.topRoles(10);
    await InsightRepository.skillPostingTrend(30, 10);
    await InsightRepository.findListedJobs({}, 300);
    await InsightRepository.findSkillsForJobs([1, 2]);

    for (const { sql } of calls) {
        for (const col of ["email", "enrollment", "mobile", "dob", "password", "full_name", "profile_photo"]) {
            assert.equal(sql.includes(col), false, `${col} in: ${sql.slice(0, 60)}`);
        }
    }
    assert.equal(calls[1].sql.includes("LIMIT"), false); // the full count map is used for tie-breaking
});

test("the viewer's skills are read for the viewer only; job filters are bound and escaped", async () => {
    const calls = captureSql();
    await InsightRepository.viewerSkills(42);
    await InsightRepository.findListedJobs({ jobType: "INTERNSHIP", role: "50%_dev" }, 300);

    assert.match(calls[0].sql, /WHERE p\.user_id = \?/);
    assert.deepEqual(calls[0].params, [42]);
    assert.match(calls[1].sql, /j\.job_type = \? AND j\.title LIKE \?/);
    assert.deepEqual(calls[1].params, ["INTERNSHIP", "%50\\%\\_dev%"]);
    assert.match(calls[1].sql, /LIMIT 300/);
});

// ======================= HTTP =======================

let server, base;

before(async () => {
    const app = express();
    app.use("/api/insights", insightRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/insights`;
});
after(() => server.close());

const bearer = (userId) => ({ Authorization: `Bearer ${jwt.sign({ userId, role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "1h" })}` });
const session = (userId, status = "ACTIVE") =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role: "STUDENT", status }));

test("HTTP: analytics need a signed-in, ACTIVE user", async () => {
    assert.equal((await fetch(`${base}/industry-pulse`)).status, 401);
    assert.equal((await fetch(`${base}/skill-gap`)).status, 401);
    session(5, "BLOCKED");
    assert.equal((await fetch(`${base}/industry-pulse`, { headers: bearer(5) })).status, 401);
});

test("HTTP: industry pulse and skill gap return their reports", async () => {
    session(5);
    stubPulse();
    mock.method(InsightRepository, "findListedJobs", async () => jobs);
    const viewerSkills = mock.method(InsightRepository, "viewerSkills", async () => []);
    mock.method(InsightRepository, "findSkillsForJobs", async () => jobSkillRows);

    const pulse = await (await fetch(`${base}/industry-pulse`, { headers: bearer(5) })).json();
    assert.equal(pulse.success, true);
    assert.equal(pulse.data.alumni_skills[0].skill, "React");

    const res = await fetch(`${base}/skill-gap?job_type=FULL_TIME&role=engineer`, { headers: bearer(5) });
    const gap = await res.json();
    assert.equal(res.status, 200);
    assert.equal(gap.data.summary.missing_skills, 7);
    assert.deepEqual(viewerSkills.mock.calls[0].arguments, [5]); // from the session
});

test("HTTP: skill gap can't be asked for someone else, and bad filters are a 400", async () => {
    session(5);
    const viewerSkills = mock.method(InsightRepository, "viewerSkills", async () => []);

    assert.equal((await fetch(`${base}/skill-gap?user_id=9`, { headers: bearer(5) })).status, 400);
    assert.equal((await fetch(`${base}/skill-gap?job_type=NOPE`, { headers: bearer(5) })).status, 400);
    assert.equal(viewerSkills.mock.callCount(), 0);
});

test("HTTP: analytics endpoints are rate limited per user", async () => {
    stubPulse();
    session(777);
    const statuses = [];
    for (let i = 0; i < 32; i++) statuses.push((await fetch(`${base}/industry-pulse`, { headers: bearer(777) })).status);

    assert.equal(statuses.filter((s) => s === 200).length, 30);
    assert.deepEqual(statuses.slice(30), [429, 429]);

    // another user is unaffected
    session(778);
    assert.equal((await fetch(`${base}/industry-pulse`, { headers: bearer(778) })).status, 200);
});
