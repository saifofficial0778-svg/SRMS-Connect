process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const JobRepository = require("../src/modules/job/job.repository");
const JobService = require("../src/modules/job/job.service");
const { createJobSchema, updateJobSchema, updateJobStatusSchema, listJobsSchema } = require("../src/modules/job/job.validation");
const { buildJobFilter } = require("../src/modules/job/job.queryBuilder");
const jobRoutes = require("../src/modules/job/job.route");
const NotificationRepository = require("../src/modules/notification/notification.repository");
const NotificationService = require("../src/modules/notification/notification.service");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const stubNotifications = require("./helpers/stubNotifications");
const registry = require("../src/socket/socketRegistry");
const CareerService = require("../src/modules/career/career.service");

const stubSkills = require("./helpers/stubSkills");

let stubs;
let closeRequests;
beforeEach(() => {
    stubs = stubNotifications(mock);
    stubSkills(mock);
    // deleting a job also closes its referral requests (career module); keep that off the real DB
    closeRequests = mock.method(CareerService, "closeRequestsForDeletedJob", async () => 0);
});
afterEach(() => mock.restoreAll());

const ALUMNUS = { userId: 10, role: "ALUMNI" };
const STUDENT = { userId: 1, role: "STUDENT" };

const validJob = {
    title: "Backend Engineer",
    company: "Acme Labs",
    location: "Noida",
    job_type: "FULL_TIME",
    description: "Build and operate our services. ".repeat(3),
    apply_url: "https://acme.example/careers/42",
};

// a row as the repository returns it (poster profile joined in), with sensitive extras a careless
// query could have selected
const jobRow = (over = {}) => ({
    id: 7,
    poster_id: 10,
    title: "Backend Engineer",
    company: "Acme Labs",
    location: "Noida",
    job_type: "FULL_TIME",
    experience_min: 1,
    experience_max: 3,
    status: "OPEN",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    description: "Full description",
    description_preview: "Full desc",
    apply_url: "https://acme.example/apply",
    poster_name: "Arjun Verma",
    poster_photo: "p.jpg",
    poster_designation: "Engineer",
    poster_company: "Acme",
    poster_role: "ALUMNI",
    poster_status: "ACTIVE",
    poster_email: "arjun@secret.test",
    poster_enrollment: "EN999",
    ...over,
});

// ======================= validation =======================

test("create: a valid job passes; defaults and skill de-duplication apply", () => {
    const r = createJobSchema.parse({ ...validJob, skills: ["React", "react", " Node.js ", "C++"] });
    assert.equal(r.experience_min, 0);
    assert.equal(r.experience_max, null);
    assert.deepEqual(r.skills, ["React", "Node.js", "C++"]);
    assert.deepEqual(createJobSchema.parse(validJob).skills, []);
});

test("create: the application link must be a safe https URL", () => {
    const ok = (apply_url) => createJobSchema.safeParse({ ...validJob, apply_url }).success;
    assert.equal(ok("https://acme.example/apply?id=3"), true);
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "http://acme.example", "ftp://acme.example", "acme.example/apply", "https://user:pass@acme.example", "//acme.example", ""]) {
        assert.equal(ok(bad), false, bad);
    }
});

test("create: required fields, lengths, types and unknown fields are validated", () => {
    const fails = (over) => createJobSchema.safeParse({ ...validJob, ...over }).success === false;
    assert.equal(fails({ title: "ab" }), true);
    assert.equal(fails({ title: "x".repeat(151) }), true);
    assert.equal(fails({ company: "" }), true);
    assert.equal(fails({ location: " " }), true);
    assert.equal(fails({ description: "too short" }), true);
    assert.equal(fails({ description: "x".repeat(5001) }), true);
    assert.equal(fails({ job_type: "VOLUNTEER" }), true);
    assert.equal(fails({ experience_min: -1 }), true);
    assert.equal(fails({ experience_min: 41 }), true);
    assert.equal(fails({ experience_min: 1.5 }), true);
    assert.equal(fails({ experience_min: 5, experience_max: 2 }), true);
    assert.equal(fails({ skills: Array.from({ length: 11 }, (_, i) => `skill${i}`) }), true);
    assert.equal(fails({ skills: ["<script>"] }), true);
    // can't set ownership / state / ids through the body
    assert.equal(fails({ poster_id: 99 }), true);
    assert.equal(fails({ status: "CLOSED" }), true);
    assert.equal(fails({ id: 5 }), true);
    for (const missing of ["title", "company", "location", "job_type", "description", "apply_url"]) {
        const copy = { ...validJob };
        delete copy[missing];
        assert.equal(createJobSchema.safeParse(copy).success, false, `${missing} is required`);
    }
});

test("update: partial, but never empty, never with unknown fields", () => {
    assert.equal(updateJobSchema.safeParse({ title: "New title" }).success, true);
    assert.equal(updateJobSchema.safeParse({}).success, false);
    assert.equal(updateJobSchema.safeParse({ poster_id: 3 }).success, false);
    assert.equal(updateJobSchema.safeParse({ status: "CLOSED" }).success, false); // status has its own endpoint
    assert.equal(updateJobSchema.safeParse({ experience_min: 4, experience_max: 2 }).success, false);
    assert.equal(updateJobSchema.safeParse({ apply_url: "http://insecure.example" }).success, false);
});

test("status accepts only OPEN / CLOSED", () => {
    assert.equal(updateJobStatusSchema.safeParse({ status: "CLOSED" }).success, true);
    assert.equal(updateJobStatusSchema.safeParse({ status: "DELETED" }).success, false);
});

test("list query: defaults, coercion, skills split, bad values rejected", () => {
    const r = listJobsSchema.parse({ q: "engineer", experience: "2", skills: "React, Node,, a", mine: "true", limit: "" });
    assert.equal(r.page, 1);
    assert.equal(r.limit, 10);
    assert.equal(r.experience, 2);
    assert.deepEqual(r.skills, ["React", "Node", "a"]);
    assert.equal(r.mine, true);
    assert.equal(listJobsSchema.parse({}).mine, false);
    for (const bad of [{ q: "a" }, { job_type: "NOPE" }, { limit: "500" }, { page: "0" }, { experience: "-1" }, { status: "DELETED" }, { mine: "maybe" }]) {
        assert.equal(listJobsSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
});

// ======================= query builder =======================

test("public listing only shows OPEN jobs of ACTIVE alumni", () => {
    const { whereSql, params } = buildJobFilter({ viewerId: 5, mine: false });
    assert.match(whereSql, /j\.status = 'OPEN'/);
    assert.match(whereSql, /u\.status = 'ACTIVE'/);
    assert.match(whereSql, /u\.role = 'ALUMNI'/);
    assert.deepEqual(params, []);
});

test("'mine' is scoped to the viewer and never shows deleted jobs", () => {
    const { whereSql, params } = buildJobFilter({ viewerId: 5, mine: true });
    assert.match(whereSql, /j\.poster_id = \?/);
    assert.match(whereSql, /j\.status IN \('OPEN', 'CLOSED'\)/);
    assert.deepEqual(params, [5]);
    assert.equal(whereSql.includes("DELETED"), false);

    const closed = buildJobFilter({ viewerId: 5, mine: true, status: "CLOSED" });
    assert.match(closed.whereSql, /j\.status = \?/);
    assert.deepEqual(closed.params, [5, "CLOSED"]);
});

test("every filter is a bound parameter; wildcards are escaped", () => {
    const evil = "x'; DROP TABLE jobs; --";
    const { whereSql, params } = buildJobFilter({
        viewerId: 1, q: "dev 50%", company: evil, location: "Noida", jobType: "INTERNSHIP", experience: 2, skills: ["React", "Node"],
    });
    assert.equal(whereSql.includes("DROP"), false);
    assert.equal((whereSql.match(/\?/g) || []).length, params.length);
    assert.ok(params.includes(`%${evil}%`));
    assert.ok(params.includes("%50\\%%"));
    assert.match(whereSql, /j\.job_type = \?/);
    assert.match(whereSql, /j\.experience_min <= \? AND \(j\.experience_max IS NULL OR j\.experience_max >= \?\)/);
    assert.equal((whereSql.match(/js\.skill_key IN \(\?\)/g) || []).length, 2); // every skill required
    assert.ok(params.includes("react") && params.includes("node")); // matched on the normalized key
});

test("experience 0 is a real filter value (fresher jobs), not 'no filter'", () => {
    const { whereSql, params } = buildJobFilter({ viewerId: 1, experience: 0 });
    assert.match(whereSql, /experience_min <= \?/);
    assert.deepEqual(params, [0, 0]);
});

// ======================= service: authorization =======================

test("only alumni can post a job - students are refused and nothing is stored", async () => {
    const create = mock.method(JobRepository, "createJob", async () => 1);
    mock.method(JobRepository, "countOpenByPoster", async () => 0);

    await assert.rejects(JobService.createJob(STUDENT, validJob), { statusCode: 403 });
    await assert.rejects(JobService.createJob({ userId: 1, role: "ADMIN" }, validJob), { statusCode: 403 });

    assert.equal(create.mock.callCount(), 0);
    assert.equal(stubs.notifyJobPosted.mock.callCount(), 0);
});

test("an alumnus can post; the poster comes from the session, and connections are notified", async () => {
    mock.method(JobRepository, "countOpenByPoster", async () => 2);
    const create = mock.method(JobRepository, "createJob", async () => 77);

    const result = await JobService.createJob(ALUMNUS, createJobSchema.parse(validJob));

    assert.deepEqual(result, { id: 77 });
    assert.equal(create.mock.calls[0].arguments[0], 10);
    assert.deepEqual(stubs.notifyJobPosted.mock.calls[0].arguments[0], {
        posterId: 10, jobId: 77, title: "Backend Engineer", company: "Acme Labs",
    });
});

test("posting is capped at 10 open jobs per alumnus", async () => {
    mock.method(JobRepository, "countOpenByPoster", async () => 10);
    const create = mock.method(JobRepository, "createJob", async () => 1);

    await assert.rejects(JobService.createJob(ALUMNUS, validJob), { statusCode: 400 });
    assert.equal(create.mock.callCount(), 0);
});

test("only the poster can edit, close or delete a job", async () => {
    mock.method(JobRepository, "findJobById", async () => jobRow({ poster_id: 10 }));
    const update = mock.method(JobRepository, "updateJob", async () => {});
    const status = mock.method(JobRepository, "setStatus", async () => 1);
    const del = mock.method(JobRepository, "softDelete", async () => 1);
    const other = { userId: 99, role: "ALUMNI" }; // an alumnus, but not the poster

    for (const viewer of [other, STUDENT]) {
        await assert.rejects(JobService.updateJob(viewer, 7, { title: "Hacked" }), { statusCode: 403 });
        await assert.rejects(JobService.setStatus(viewer, 7, "CLOSED"), { statusCode: 403 });
        await assert.rejects(JobService.deleteJob(viewer, 7), { statusCode: 403 });
    }
    assert.equal(update.mock.callCount() + status.mock.callCount() + del.mock.callCount(), 0);
    assert.equal(stubs.removeJobNotifications.mock.callCount(), 0);
});

test("missing, deleted and malformed job ids", async () => {
    mock.method(JobRepository, "findJobById", async (id) => (id === 8 ? jobRow({ id: 8, status: "DELETED" }) : undefined));

    await assert.rejects(JobService.updateJob(ALUMNUS, 999, { title: "x" }), { statusCode: 404 });
    await assert.rejects(JobService.updateJob(ALUMNUS, 8, { title: "x" }), { statusCode: 404 }); // deleted
    await assert.rejects(JobService.deleteJob(ALUMNUS, 8), { statusCode: 404 });
    await assert.rejects(JobService.updateJob(ALUMNUS, "abc", { title: "x" }), { statusCode: 400 });
    await assert.rejects(JobService.getJob(STUDENT, "0"), { statusCode: 400 });
});

test("owner edit: writes the given fields; the merged experience range is re-checked", async () => {
    mock.method(JobRepository, "findJobById", async () => jobRow({ experience_min: 1, experience_max: 3 }));
    const update = mock.method(JobRepository, "updateJob", async () => {});

    await JobService.updateJob(ALUMNUS, 7, { title: "Senior Engineer", skills: ["Go"] });
    assert.deepEqual(update.mock.calls[0].arguments, [7, { title: "Senior Engineer", skills: ["Go"] }]);

    // raising min above the stored max would break the range
    await assert.rejects(JobService.updateJob(ALUMNUS, 7, { experience_min: 5 }), { statusCode: 400 });
    await JobService.updateJob(ALUMNUS, 7, { experience_min: 2, experience_max: null }); // open-ended is fine
});

test("close / reopen: owner only, no-op changes refused, reopening respects the cap", async () => {
    let current = jobRow({ status: "OPEN" });
    mock.method(JobRepository, "findJobById", async () => current);
    const setStatus = mock.method(JobRepository, "setStatus", async () => 1);
    const open = mock.method(JobRepository, "countOpenByPoster", async () => 3);

    assert.deepEqual(await JobService.setStatus(ALUMNUS, 7, "CLOSED"), { id: 7, status: "CLOSED" });
    await assert.rejects(JobService.setStatus(ALUMNUS, 7, "OPEN"), { statusCode: 400 }); // already open

    current = jobRow({ status: "CLOSED" });
    await JobService.setStatus(ALUMNUS, 7, "OPEN");
    assert.equal(setStatus.mock.callCount(), 2);

    open.mock.mockImplementation(async () => 10);
    await assert.rejects(JobService.setStatus(ALUMNUS, 7, "OPEN"), { statusCode: 400 });
});

test("delete is a soft delete and removes the job's announcements", async () => {
    mock.method(JobRepository, "findJobById", async () => jobRow());
    const del = mock.method(JobRepository, "softDelete", async () => 1);

    assert.equal(await JobService.deleteJob(ALUMNUS, 7), true);

    assert.deepEqual(del.mock.calls[0].arguments, [7]);
    assert.deepEqual(stubs.removeJobNotifications.mock.calls[0].arguments, [7]);
    assert.equal(closeRequests.mock.calls[0].arguments[0], 7); // its pending referral requests are closed too
});

// ======================= service: what viewers see =======================

test("listing exposes only whitelisted fields - no application link, email or enrollment", async () => {
    const find = mock.method(JobRepository, "findJobs", async () => [jobRow()]);
    mock.method(JobRepository, "countJobs", async () => 23);
    mock.method(JobRepository, "findSkillsForJobs", async () => ({ 7: ["React"] }));

    const result = await JobService.listJobs(STUDENT, listJobsSchema.parse({ page: "3", limit: "10", job_type: "FULL_TIME", experience: "2" }));

    const [filters, limit, offset] = find.mock.calls[0].arguments;
    assert.equal(filters.viewerId, 1);
    assert.equal(filters.jobType, "FULL_TIME");
    assert.equal(filters.experience, 2);
    assert.equal(limit, 10);
    assert.equal(offset, 20);
    assert.deepEqual(result.pagination, { page: 3, limit: 10, total: 23, totalPages: 3 });
    assert.equal(result.can_post, false);

    const [job] = result.jobs;
    assert.deepEqual(Object.keys(job).sort(), [
        "company", "created_at", "description_preview", "experience_max", "experience_min", "id", "is_owner",
        "job_type", "location", "poster", "skills", "status", "title", "updated_at",
    ]);
    assert.deepEqual(Object.keys(job.poster).sort(), ["company", "designation", "full_name", "is_verified_alumni", "profile_photo", "user_id"]);
    assert.equal(job.poster.is_verified_alumni, true);
    assert.equal(job.is_owner, false);
    assert.deepEqual(job.skills, ["React"]);
    const json = JSON.stringify(result);
    for (const secret of ["arjun@secret.test", "EN999", "apply_url", "acme.example/apply"]) {
        assert.equal(json.includes(secret), false, `${secret} leaked in the listing`);
    }
});

test("only alumni are told they can post (the UI uses this to show the button)", async () => {
    mock.method(JobRepository, "findJobs", async () => []);
    mock.method(JobRepository, "countJobs", async () => 0);
    mock.method(JobRepository, "findSkillsForJobs", async () => ({}));

    assert.equal((await JobService.listJobs(ALUMNUS, listJobsSchema.parse({}))).can_post, true);
    assert.equal((await JobService.listJobs({ userId: 2, role: "ADMIN" }, listJobsSchema.parse({}))).can_post, false);
});

test("a poster without a profile row still shows up, with a fallback name", async () => {
    mock.method(JobRepository, "findJobs", async () => [jobRow({ poster_name: null })]);
    mock.method(JobRepository, "countJobs", async () => 1);
    mock.method(JobRepository, "findSkillsForJobs", async () => ({}));

    const { jobs } = await JobService.listJobs(STUDENT, listJobsSchema.parse({}));
    assert.equal(jobs[0].poster.full_name, "SRMS Alumni");
});

test("detail: full description and application link for an open job", async () => {
    mock.method(JobRepository, "findJobById", async () => jobRow());
    mock.method(JobRepository, "findSkillsForJobs", async () => ({ 7: ["Node.js"] }));

    const job = await JobService.getJob(STUDENT, 7);

    assert.equal(job.description, "Full description");
    assert.equal(job.apply_url, "https://acme.example/apply");
    assert.equal(job.is_owner, false);
    assert.equal("description_preview" in job, false);
    assert.equal(JSON.stringify(job).includes("secret.test"), false);
    assert.equal(JSON.stringify(job).includes("EN999"), false);
});

test("detail: a closed job is shown as closed without its application link (the owner keeps it)", async () => {
    mock.method(JobRepository, "findJobById", async () => jobRow({ status: "CLOSED" }));
    mock.method(JobRepository, "findSkillsForJobs", async () => ({}));

    const asStudent = await JobService.getJob(STUDENT, 7);
    assert.equal(asStudent.status, "CLOSED");
    assert.equal(asStudent.apply_url, null);

    const asOwner = await JobService.getJob(ALUMNUS, 7);
    assert.equal(asOwner.apply_url, "https://acme.example/apply");
    assert.equal(asOwner.is_owner, true);
});

test("detail: deleted jobs and jobs of inactive posters are 404 for everyone but (for inactive) the owner", async () => {
    mock.method(JobRepository, "findSkillsForJobs", async () => ({}));
    const find = mock.method(JobRepository, "findJobById", async () => jobRow({ status: "DELETED" }));

    await assert.rejects(JobService.getJob(STUDENT, 7), { statusCode: 404 });
    await assert.rejects(JobService.getJob(ALUMNUS, 7), { statusCode: 404 }); // not even the owner

    find.mock.mockImplementation(async () => jobRow({ poster_status: "BLOCKED" }));
    await assert.rejects(JobService.getJob(STUDENT, 7), { statusCode: 404 });
    await assert.rejects(JobService.getJob({ userId: 2, role: "ALUMNI" }, 7), { statusCode: 404 });

    find.mock.mockImplementation(async () => jobRow({ poster_role: "STUDENT" })); // not an alumnus (any more)
    await assert.rejects(JobService.getJob(STUDENT, 7), { statusCode: 404 });
});

// ======================= the SQL that actually runs =======================

function captureSql() {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql: sql.replace(/\s+/g, " "), params });
        return [[{ total: 0 }], []];
    });
    return calls;
}

test("job queries never select private user columns, and keep jobs of profile-less posters", async () => {
    const calls = captureSql();
    await JobRepository.findJobs({ viewerId: 1, mine: false }, 10, 0);
    await JobRepository.findJobById(7);

    for (const { sql } of calls) {
        const select = sql.slice(sql.indexOf("SELECT"), sql.indexOf(" FROM jobs"));
        for (const col of ["email", "enrollment", "mobile", "dob", "password"]) {
            assert.equal(select.includes(col), false, `${col} must not be selected`);
        }
        assert.match(sql, /LEFT JOIN profiles p/);
    }
    assert.match(calls[0].sql, /LIMIT 10 OFFSET 0/);
    assert.equal(calls[0].sql.includes("apply_url"), false); // not part of the listing
    assert.match(calls[1].sql, /j\.apply_url/);
});

test("updates only touch whitelisted columns of a not-deleted job", async () => {
    const executed = [];
    const connection = {
        beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
        execute: async (sql, params) => { executed.push({ sql: sql.replace(/\s+/g, " "), params }); return [{ insertId: 0 }]; },
    };
    mock.method(pool, "getConnection", async () => connection);

    // a hostile extra key (should be impossible after validation, but must still be inert)
    await JobRepository.updateJob(7, { title: "T", "status = 'OPEN', poster_id": 1, skills: ["Go"] });

    const update = executed.find((e) => e.sql.startsWith("UPDATE jobs"));
    assert.equal(update.sql, "UPDATE jobs SET title = ? WHERE id = ? AND status <> 'DELETED'");
    assert.deepEqual(update.params, ["T", 7]);
    assert.ok(executed.some((e) => e.sql.startsWith("DELETE FROM job_skills")));
    assert.ok(executed.some((e) => e.sql.startsWith("INSERT INTO job_skills")));
});

test("create writes the job and its skills in one transaction, rolling back on failure", async () => {
    const log = [];
    const connection = {
        beginTransaction: async () => log.push("begin"),
        commit: async () => log.push("commit"),
        rollback: async () => log.push("rollback"),
        release: () => log.push("release"),
        execute: async (sql) => {
            if (sql.includes("INSERT INTO job_skills")) throw new Error("boom");
            return [{ insertId: 5 }];
        },
    };
    mock.method(pool, "getConnection", async () => connection);

    await assert.rejects(JobRepository.createJob(10, { ...validJob, experience_min: 0, skills: ["Go"] }), /boom/);
    assert.deepEqual(log, ["begin", "rollback", "release"]);
});

// ======================= job notifications =======================

test("a new job is announced to the poster's connections only, then pushed live to each", async () => {
    mock.restoreAll(); // use the real NotificationService here
    const pushed = [];
    registry.setIo({ to: (room) => ({ emit: (event, payload) => pushed.push({ room, event, payload }) }) });
    const insert = mock.method(NotificationRepository, "insertForConnections", async () => 2);
    mock.method(NotificationRepository, "findByDedupeKey", async () => [
        { id: 1, recipient_id: 20 },
        { id: 2, recipient_id: 21 },
    ]);
    mock.method(NotificationRepository, "findVisibleById", async (id) => ({
        id, type: "JOB_POSTED", reference_id: 7, extra: "x", is_read: 0, created_at: "t", actor_id: 10, actor_name: "Arjun", actor_photo: null,
    }));
    mock.method(NotificationRepository, "countByRecipient", async () => 1);

    await NotificationService.notifyJobPosted({ posterId: 10, jobId: 7, title: "Backend Engineer", company: "Acme" });

    assert.deepEqual(insert.mock.calls[0].arguments[0], {
        actorId: 10, type: "JOB_POSTED", referenceId: 7, extra: "Backend Engineer at Acme", dedupeKey: "JOB_POSTED:7", limit: 200,
    });
    assert.deepEqual(pushed.map((p) => [p.room, p.event, p.payload.notification.type]), [
        ["user:20", "notification", "JOB_POSTED"],
        ["user:21", "notification", "JOB_POSTED"],
    ]);
    registry.setIo(null);
});

test("nothing is pushed when no connection was notified (or the announcement was a duplicate)", async () => {
    mock.restoreAll();
    const pushed = [];
    registry.setIo({ to: () => ({ emit: (...a) => pushed.push(a) }) });
    mock.method(NotificationRepository, "insertForConnections", async () => 0);
    const find = mock.method(NotificationRepository, "findByDedupeKey", async () => []);

    await NotificationService.notifyJobPosted({ posterId: 10, jobId: 7, title: "T", company: "C" });

    assert.equal(find.mock.callCount(), 0);
    assert.equal(pushed.length, 0);
    registry.setIo(null);
});

test("a failing announcement never breaks job creation", async () => {
    mock.restoreAll();
    mock.method(NotificationRepository, "insertForConnections", async () => { throw new Error("db down"); });
    mock.method(console, "error", () => {});
    await assert.doesNotReject(NotificationService.notifyJobPosted({ posterId: 10, jobId: 7, title: "T", company: "C" }));
});

test("the connections announcement SQL targets only ACTIVE, ACCEPTED connections and is deduplicated", async () => {
    mock.restoreAll();
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => { calls.push({ sql: sql.replace(/\s+/g, " "), params }); return [{ affectedRows: 0 }, []]; });

    await NotificationRepository.insertForConnections({ actorId: 10, type: "JOB_POSTED", referenceId: 7, extra: "x", dedupeKey: "JOB_POSTED:7", limit: 200 });

    assert.match(calls[0].sql, /INSERT IGNORE INTO notifications/);
    assert.match(calls[0].sql, /c\.status = 'ACCEPTED'/);
    assert.match(calls[0].sql, /u\.status = 'ACTIVE'/);
    assert.match(calls[0].sql, /LIMIT 200/);
    assert.equal(calls[0].sql.includes("FROM users u WHERE"), false); // never "everyone"
});

test("deleting a job removes its announcements and refreshes recipients", async () => {
    mock.restoreAll();
    const emitted = [];
    registry.setIo({ to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) });
    const del = mock.method(NotificationRepository, "deleteByReference", async () => [20]);
    mock.method(NotificationRepository, "countByRecipient", async () => 0);

    await NotificationService.removeJobNotifications(7);

    assert.deepEqual(del.mock.calls[0].arguments, [["JOB_POSTED"], 7]);
    assert.equal(emitted[0].room, "user:20");
    registry.setIo(null);
});

// ======================= HTTP API =======================

let server, base;

before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/jobs", jobRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/jobs`;
});
after(() => server.close());

const bearer = (userId, role) => ({
    Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
    "Content-Type": "application/json",
});
// the session row decides role/status, not the token
const session = (userId, role, status = "ACTIVE") =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role, status }));
const send = (method, path, who, body) =>
    fetch(`${base}${path}`, { method, headers: bearer(who.userId, who.role), body: body === undefined ? undefined : JSON.stringify(body) });

test("HTTP: every jobs endpoint requires a signed-in user", async () => {
    for (const [method, path] of [["GET", ""], ["GET", "/1"], ["POST", ""], ["PATCH", "/1"], ["PATCH", "/1/status"], ["DELETE", "/1"]]) {
        assert.equal((await fetch(`${base}${path}`, { method })).status, 401, `${method} ${path}`);
    }
});

test("HTTP: a student cannot post a job - 403 even before the body is validated", async () => {
    session(1, "STUDENT");
    const create = mock.method(JobRepository, "createJob", async () => 1);

    assert.equal((await send("POST", "", STUDENT, validJob)).status, 403);
    assert.equal((await send("POST", "", STUDENT, { nonsense: true })).status, 403);
    assert.equal(create.mock.callCount(), 0);
});

test("HTTP: the role in the token is ignored - the session's role decides", async () => {
    session(1, "STUDENT"); // really a student...
    const create = mock.method(JobRepository, "createJob", async () => 1);
    // ...holding a token that claims ALUMNI
    assert.equal((await send("POST", "", { userId: 1, role: "ALUMNI" }, validJob)).status, 403);
    assert.equal(create.mock.callCount(), 0);
});

test("HTTP: a blocked alumnus cannot post", async () => {
    session(10, "ALUMNI", "BLOCKED");
    assert.equal((await send("POST", "", ALUMNUS, validJob)).status, 401);
});

test("HTTP: an alumnus posts a job (201); invalid input is a 400 with details; ownership can't be forged", async () => {
    session(10, "ALUMNI");
    mock.method(JobRepository, "countOpenByPoster", async () => 0);
    const create = mock.method(JobRepository, "createJob", async () => 55);

    const ok = await send("POST", "", ALUMNUS, validJob);
    assert.equal(ok.status, 201);
    assert.deepEqual((await ok.json()).data, { id: 55 });
    assert.equal(create.mock.calls[0].arguments[0], 10);

    const invalid = await send("POST", "", ALUMNUS, { ...validJob, apply_url: "javascript:alert(1)" });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).message, "Validation failed");

    const forged = await send("POST", "", ALUMNUS, { ...validJob, poster_id: 3 });
    assert.equal(forged.status, 400);
    assert.equal(create.mock.callCount(), 1);
});

test("HTTP: list returns jobs with pagination; bad query is a 400; students can browse", async () => {
    session(1, "STUDENT");
    mock.method(JobRepository, "findJobs", async () => [jobRow()]);
    mock.method(JobRepository, "countJobs", async () => 1);
    mock.method(JobRepository, "findSkillsForJobs", async () => ({ 7: ["React"] }));

    const res = await send("GET", "?q=engineer&job_type=FULL_TIME&page=1&limit=5", STUDENT);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.jobs[0].title, "Backend Engineer");
    assert.deepEqual(body.data.pagination, { page: 1, limit: 5, total: 1, totalPages: 1 });
    assert.equal(body.data.can_post, false);

    assert.equal((await send("GET", "?job_type=NOPE", STUDENT)).status, 400);
    assert.equal((await send("GET", "?limit=500", STUDENT)).status, 400);
});

test("HTTP: detail, 404 and bad ids", async () => {
    session(1, "STUDENT");
    const find = mock.method(JobRepository, "findJobById", async () => jobRow());
    mock.method(JobRepository, "findSkillsForJobs", async () => ({}));

    const ok = await send("GET", "/7", STUDENT);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.apply_url, "https://acme.example/apply");

    find.mock.mockImplementation(async () => undefined);
    assert.equal((await send("GET", "/999", STUDENT)).status, 404);
    assert.equal((await send("GET", "/abc", STUDENT)).status, 400);
});

test("HTTP: edit / close / delete are owner-only", async () => {
    mock.method(JobRepository, "findJobById", async () => jobRow({ poster_id: 10 }));
    const update = mock.method(JobRepository, "updateJob", async () => {});
    const status = mock.method(JobRepository, "setStatus", async () => 1);
    const del = mock.method(JobRepository, "softDelete", async () => 1);
    mock.method(JobRepository, "countOpenByPoster", async () => 0);

    // someone else (even an alumnus)
    session(99, "ALUMNI");
    const intruder = { userId: 99, role: "ALUMNI" };
    assert.equal((await send("PATCH", "/7", intruder, { title: "Hacked title" })).status, 403);
    assert.equal((await send("PATCH", "/7/status", intruder, { status: "CLOSED" })).status, 403);
    assert.equal((await send("DELETE", "/7", intruder)).status, 403);
    assert.equal(update.mock.callCount() + status.mock.callCount() + del.mock.callCount(), 0);

    // the poster
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 10, role: "ALUMNI", status: "ACTIVE" }));
    assert.equal((await send("PATCH", "/7", ALUMNUS, { title: "Senior Engineer" })).status, 200);
    assert.equal((await send("PATCH", "/7/status", ALUMNUS, { status: "CLOSED" })).status, 200);
    assert.equal((await send("DELETE", "/7", ALUMNUS)).status, 200);
    assert.equal(update.mock.callCount(), 1);
    assert.equal(status.mock.callCount(), 1);
    assert.equal(del.mock.callCount(), 1);
});

test("HTTP: invalid edit payloads are rejected", async () => {
    session(10, "ALUMNI");
    mock.method(JobRepository, "findJobById", async () => jobRow());
    assert.equal((await send("PATCH", "/7", ALUMNUS, {})).status, 400);
    assert.equal((await send("PATCH", "/7", ALUMNUS, { poster_id: 5 })).status, 400);
    assert.equal((await send("PATCH", "/7/status", ALUMNUS, { status: "DELETED" })).status, 400);
});

