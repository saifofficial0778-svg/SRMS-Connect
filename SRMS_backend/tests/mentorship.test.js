process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const Repo = require("../src/modules/mentorship/mentorship.repository");
const Service = require("../src/modules/mentorship/mentorship.service");
const V = require("../src/modules/mentorship/mentorship.validation");
const { scoreMentor, rankMentors } = require("../src/modules/mentorship/mentorship.matching");
const { MATCH_WEIGHTS: W, LIMITS } = require("../src/modules/mentorship/mentorship.constants");
const InsightService = require("../src/modules/insight/insight.service");
const mentorshipRoutes = require("../src/modules/mentorship/mentorship.route");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const stubNotifications = require("./helpers/stubNotifications");
const stubSkills = require("./helpers/stubSkills");

let notes;
beforeEach(() => {
    notes = stubNotifications(mock);
    stubSkills(mock);
});
afterEach(() => mock.restoreAll());

const STUDENT = { userId: 1, role: "STUDENT" };
const MENTOR = { userId: 10, role: "ALUMNI" };
const OUTSIDER = { userId: 55, role: "STUDENT" };
const MESSAGE = "I have campus interviews next month and would love structured practice.";

const validProfile = {
    bio: "Backend engineer, happy to help with interviews and projects.",
    availability: "Weekends, about 2 hours a week",
    max_active_mentees: 3,
    topics: ["INTERVIEW_PREP", "CAREER_GUIDANCE"],
    areas: ["Computer Applications"],
};
const validRequest = { mentor_id: 10, topic: "INTERVIEW_PREP", message: MESSAGE };

// a mentor row as the repository returns it, plus a column a careless query could have added
const mentorRow = (over = {}) => ({
    user_id: 10, bio: validProfile.bio, availability: validProfile.availability, max_active_mentees: 3, is_accepting: 1,
    profile_id: 40, full_name: "Arjun Verma", profile_photo: null, designation: "Engineer", company: "Acme",
    branch: "Computer Applications", batch_year: 2020, role: "ALUMNI", status: "ACTIVE", active_mentees: 1,
    email: "arjun@secret.test", ...over,
});

const mentorshipRow = (over = {}) => ({
    id: 5, mentor_id: 10, mentee_id: 1, topic: "INTERVIEW_PREP", message: MESSAGE, response: null, closing_note: null,
    status: "PENDING", started_at: null, ended_at: null, created_at: "t0", updated_at: "t0",
    mentor_name: "Arjun Verma", mentor_photo: null, mentor_designation: "Engineer", mentor_company: "Acme",
    mentor_status: "ACTIVE", mentor_role: "ALUMNI",
    mentee_name: "Aarav Sharma", mentee_photo: null, mentee_branch: "Computer Applications", mentee_batch_year: 2025,
    mentee_status: "ACTIVE", mentee_role: "STUDENT",
    mentee_email: "aarav@secret.test", mentor_enrollment: "EN999", ...over,
});

// the pieces loaded around a mentor row (an explicitly passed `undefined` means "not found")
function stubMentor(opts = {}) {
    const pick = (key, fallback) => (key in opts ? opts[key] : fallback);
    const row = pick("row", mentorRow());
    return {
        find: mock.method(Repo, "findMentorByUserId", async () => row),
        tags: mock.method(Repo, "findTagsForMentors", async () => pick("tags", { 10: { topics: ["INTERVIEW_PREP", "CAREER_GUIDANCE"], areas: ["Computer Applications"] } })),
        skills: mock.method(Repo, "findSkillsForProfiles", async () => pick("skills", { 40: [{ key: "react", name: "React" }, { key: "nodejs", name: "Node.js" }] })),
        openTo: mock.method(Repo, "findOpenToMentorship", async () => pick("openTo", new Set([10]))),
        pending: mock.method(Repo, "countPendingByMentee", async () => pick("pending", 0)),
        create: mock.method(Repo, "createMentorship", async () => 77),
    };
}

function stubContext({ connected = new Set(), branch = "Computer Applications", missing = [] } = {}) {
    mock.method(Repo, "findConnectedUserIds", async () => connected);
    mock.method(Repo, "findViewerBranch", async () => branch);
    return mock.method(InsightService, "getSkillGap", async () => ({ missing }));
}

// ======================= validation =======================

test("mentor profile: valid data passes; bad or forged input is rejected", () => {
    const ok = (over) => V.mentorProfileSchema.safeParse({ ...validProfile, ...over }).success;
    assert.equal(ok({}), true);
    assert.equal(V.mentorProfileSchema.parse(validProfile).is_accepting, true); // default
    assert.equal(ok({ areas: undefined }), true);
    assert.equal(ok({ topics: [] }), false); // must mentor on something
    assert.equal(ok({ topics: ["ASTROLOGY"] }), false);
    assert.equal(ok({ topics: ["INTERVIEW_PREP", "INTERVIEW_PREP"] }), false);
    assert.equal(ok({ max_active_mentees: 0 }), false);
    assert.equal(ok({ max_active_mentees: 21 }), false);
    assert.equal(ok({ bio: "too short" }), false);
    assert.equal(ok({ areas: ["CA", "ca"] }), false); // same area twice
    assert.equal(ok({ areas: ["a", "b", "c", "d", "e", "f"].map((x) => x + x) }), false); // too many
    assert.equal(ok({ user_id: 5 }), false); // can't write someone else's mentor profile
    assert.equal(ok({ active_mentees: 0 }), false);
});

test("mentorship request: the mentee can't be named, and input is checked", () => {
    const ok = (over) => V.createMentorshipSchema.safeParse({ ...validRequest, ...over }).success;
    assert.equal(ok({}), true);
    assert.equal(ok({ goals: ["Crack a mock interview"] }), true);
    assert.equal(ok({ goals: ["a", "b", "c", "d"].map((g) => `goal ${g}`) }), false); // at most 3 to start with
    assert.equal(ok({ message: "pls mentor me" }), false);
    assert.equal(ok({ topic: "ASTROLOGY" }), false);
    assert.equal(ok({ mentor_id: "10" }), false);
    for (const forged of [{ mentee_id: 9 }, { student_id: 9 }, { status: "ACTIVE" }, { id: 3 }]) {
        assert.equal(ok(forged), false, JSON.stringify(forged));
    }
});

test("respond / complete / goal / session payloads", () => {
    assert.equal(V.respondSchema.safeParse({ action: "ACCEPT" }).success, true);
    assert.equal(V.respondSchema.safeParse({ action: "COMPLETE" }).success, false);
    assert.equal(V.respondSchema.safeParse({ action: "ACCEPT", status: "ACTIVE" }).success, false);
    assert.equal(V.completeSchema.parse({ note: "  " }).note, undefined);
    assert.equal(V.goalSchema.safeParse({ title: "ab" }).success, false);
    assert.equal(V.goalStatusSchema.safeParse({ status: "ARCHIVED" }).success, false);

    const session = (over) => V.sessionSchema.safeParse({ session_date: "2026-01-15", notes: "Mock interview on arrays.", ...over }).success;
    assert.equal(session({}), true);
    assert.equal(session({ duration_minutes: 45 }), true);
    assert.equal(session({ session_date: "2099-01-01" }), false); // sessions are logged after they happen
    assert.equal(session({ session_date: "15/01/2026" }), false);
    assert.equal(session({ duration_minutes: 1 }), false);
    assert.equal(session({ notes: "hi" }), false);
    assert.equal(session({ created_by: 9 }), false);
});

test("matching query: only what you want help with - never whose match it is", () => {
    assert.deepEqual(V.matchQuerySchema.parse({ topic: "INTERVIEW_PREP", skills: "React, Node,," }), { topic: "INTERVIEW_PREP", skills: ["React", "Node"] });
    assert.equal(V.matchQuerySchema.safeParse({ user_id: "9" }).success, false);
    assert.equal(V.matchQuerySchema.safeParse({ topic: "NOPE" }).success, false);
    assert.equal(V.listMentorshipsSchema.parse({}).box, "mentee");
    assert.equal(V.listMentorshipsSchema.safeParse({ box: "everyone" }).success, false);
});

// ======================= matching rules =======================

const mentor = (over = {}) => ({
    user_id: 10, full_name: "Arjun", topics: ["INTERVIEW_PREP"], areas: ["Computer Applications"],
    skills: [{ key: "react", name: "React" }, { key: "nodejs", name: "Node.js" }, { key: "aws", name: "AWS" }],
    open_to_mentorship: true, spots_left: 2, ...over,
});
const sk = (key, name) => ({ key, name });

test("every rule a mentor meets adds its points, with the reason spelled out", () => {
    const result = scoreMentor(mentor(), {
        topic: "INTERVIEW_PREP",
        requestedSkills: [sk("react", "React"), sk("python", "Python")],
        gapSkills: [sk("nodejs", "Node.js"), sk("aws", "AWS"), sk("docker", "Docker")],
        branch: "Computer Applications",
        connectedIds: new Set([10]),
    });

    assert.deepEqual(result.reasons.map((r) => [r.code, r.points]), [
        ["TOPIC", 30], ["REQUESTED_SKILL", 10], ["GAP_SKILL", 16], ["OPEN_TO", 10], ["AREA", 10], ["CONNECTED", 10],
    ]);
    assert.equal(result.score, 86);
    // the most this student could have scored with these inputs
    assert.equal(result.max_score, 30 + 20 + 24 + 10 + 10 + 10);
    assert.equal(result.percent, 83);
    assert.match(result.reasons[1].text, /React/);
    assert.match(result.reasons[2].text, /Node\.js, AWS/);
    assert.equal(result.score, result.reasons.reduce((s, r) => s + r.points, 0)); // nothing hidden
});

test("a mentor who meets nothing scores zero, with no reasons", () => {
    const result = scoreMentor(mentor({ topics: ["HIGHER_STUDIES"], areas: [], skills: [], open_to_mentorship: false }), {
        topic: "INTERVIEW_PREP", requestedSkills: [sk("react", "React")], gapSkills: [sk("aws", "AWS")], branch: "Mechanical", connectedIds: new Set(),
    });
    assert.deepEqual(result, { score: 0, max_score: 30 + 10 + 8 + 10 + 10 + 10, percent: 0, reasons: [] });
});

test("skill points are capped, and a skill is never counted twice", () => {
    const many = ["a", "b", "c", "d", "e"].map((k) => sk(k, k.toUpperCase()));
    const result = scoreMentor(mentor({ skills: many }), { requestedSkills: many, gapSkills: many, connectedIds: new Set() });
    const points = Object.fromEntries(result.reasons.map((r) => [r.code, r.points]));

    assert.equal(points.REQUESTED_SKILL, W.REQUESTED_SKILL_MAX); // 5 x 10, capped at 30
    assert.equal(points.GAP_SKILL, undefined); // all five were already counted as "asked about"

    const gapOnly = scoreMentor(mentor({ skills: many }), { gapSkills: many, connectedIds: new Set() });
    assert.equal(gapOnly.reasons.find((r) => r.code === "GAP_SKILL").points, W.GAP_SKILL_MAX); // 5 x 8, capped at 24
});

test("criteria that don't apply are left out of the maximum too", () => {
    const bare = scoreMentor(mentor(), { connectedIds: new Set() }); // no topic, no skills, no branch, no gap
    assert.equal(bare.max_score, W.OPEN_TO + W.CONNECTED);
    assert.deepEqual(bare.reasons.map((r) => r.code), ["OPEN_TO"]);
    assert.equal(bare.percent, 50);
});

test("preferred area matches the student's branch loosely, in either direction", () => {
    const area = (areas, branch) => scoreMentor(mentor({ areas }), { branch, connectedIds: new Set() }).reasons.some((r) => r.code === "AREA");
    assert.equal(area(["Computer Applications"], "computer applications"), true);
    assert.equal(area(["Computer"], "Computer Applications"), true);
    assert.equal(area(["MCA Computer Applications"], "Computer Applications"), true);
    assert.equal(area(["Mechanical"], "Computer Applications"), false);
    assert.equal(area([], "Computer Applications"), false);
});

test("ranking: mentors with a free spot first, then score, then name", () => {
    const context = { topic: "INTERVIEW_PREP", connectedIds: new Set() };
    const ranked = rankMentors(
        [
            mentor({ user_id: 1, full_name: "Zoya", spots_left: 0 }), // best score but full
            mentor({ user_id: 2, full_name: "Bela", topics: [] }),
            mentor({ user_id: 3, full_name: "Asha", topics: [] }),
            mentor({ user_id: 4, full_name: "Kiran" }),
        ],
        context
    );
    assert.deepEqual(ranked.map((m) => m.full_name), ["Kiran", "Asha", "Bela", "Zoya"]);
    assert.equal(ranked[0].match.score, 40);
});

// ======================= mentor profiles =======================

test("only alumni can become mentors; the profile is always the signed-in user's own", async () => {
    const upsert = mock.method(Repo, "upsertMentorProfile", async () => {});
    stubMentor();

    await assert.rejects(Service.saveMentorProfile(STUDENT, V.mentorProfileSchema.parse(validProfile)), { statusCode: 403 });
    await assert.rejects(Service.saveMentorProfile({ userId: 2, role: "ADMIN" }, validProfile), { statusCode: 403 });
    assert.equal(upsert.mock.callCount(), 0);

    const result = await Service.saveMentorProfile(MENTOR, V.mentorProfileSchema.parse(validProfile));
    assert.deepEqual(upsert.mock.calls[0].arguments, [10, {
        bio: validProfile.bio, availability: validProfile.availability, maxActiveMentees: 3, isAccepting: true,
        topics: ["INTERVIEW_PREP", "CAREER_GUIDANCE"], areas: ["Computer Applications"],
    }]);
    assert.equal(result.mentor.spots_left, 2); // 3 allowed, 1 active
    assert.deepEqual(result.mentor.skills, ["React", "Node.js"]); // expertise = existing profile skills
});

test("a published mentor exposes only what they chose to publish plus public profile fields", async () => {
    stubMentor();
    const { mentor: m } = await Service.getMyMentorProfile(MENTOR);
    assert.deepEqual(Object.keys(m).sort(), [
        "active_mentees", "areas", "availability", "batch_year", "bio", "company", "designation", "full_name", "is_accepting",
        "is_verified_alumni", "max_active_mentees", "open_to_mentorship", "profile_photo", "skills", "spots_left", "topics", "user_id",
    ]);
    assert.equal(JSON.stringify(m).includes("secret.test"), false);
});

// ======================= requesting mentorship =======================

test("a student can request a mentor who is accepting, has a spot and offers the topic", async () => {
    const w = stubMentor();

    const result = await Service.createMentorship(STUDENT, V.createMentorshipSchema.parse({ ...validRequest, goals: ["Crack a mock interview"] }));

    assert.deepEqual(result, { id: 77 });
    assert.deepEqual(w.create.mock.calls[0].arguments[0], {
        mentorId: 10, menteeId: 1, topic: "INTERVIEW_PREP", message: MESSAGE, goals: ["Crack a mock interview"],
    });
    const n = notes.notifyEvent.mock.calls[0].arguments[0];
    assert.deepEqual([n.type, n.recipientId, n.actorId, n.referenceId, n.dedupeKey], ["MENTORSHIP_REQUEST", 10, 1, 77, "MENTORSHIP:77:PENDING"]);
    assert.match(n.extra, /^PENDING\|INTERVIEW_PREP\|/);
});

test("only students can request, and never from themselves", async () => {
    const w = stubMentor();
    await assert.rejects(Service.createMentorship(MENTOR, validRequest), { statusCode: 403 });
    await assert.rejects(Service.createMentorship({ userId: 2, role: "ADMIN" }, validRequest), { statusCode: 403 });
    await assert.rejects(Service.createMentorship({ userId: 10, role: "STUDENT" }, validRequest), { statusCode: 400 });
    assert.equal(w.create.mock.callCount(), 0);
});

test("the mentor must be an ACTIVE alumnus with a mentor profile - anything else is 'not found'", async () => {
    for (const row of [undefined, mentorRow({ status: "BLOCKED" }), mentorRow({ role: "STUDENT" })]) {
        const w = stubMentor({ row });
        await assert.rejects(Service.createMentorship(STUDENT, validRequest), { statusCode: 404 });
        assert.equal(w.create.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
});

test("not accepting / no free spot / topic not offered / too many pending requests are refused", async () => {
    const cases = [
        [{ row: mentorRow({ is_accepting: 0 }) }, /not accepting/],
        [{ row: mentorRow({ active_mentees: 3 }) }, /no free spots/],
        [{ tags: { 10: { topics: ["HIGHER_STUDIES"], areas: [] } } }, /doesn't offer that topic/],
        [{ pending: LIMITS.MAX_PENDING_PER_MENTEE }, /requests waiting/],
    ];
    for (const [world, message] of cases) {
        const w = stubMentor(world);
        await assert.rejects(Service.createMentorship(STUDENT, validRequest), (e) => e.statusCode === 400 && message.test(e.message));
        assert.equal(w.create.mock.callCount(), 0);
        assert.equal(notes.notifyEvent.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
});

test("a second open mentorship with the same mentor (unique key) is a 409 and notifies nobody", async () => {
    const w = stubMentor();
    w.create.mock.mockImplementation(async () => { throw Object.assign(new Error("Duplicate entry '10-1-1'"), { code: "ER_DUP_ENTRY" }); });

    await assert.rejects(Service.createMentorship(STUDENT, validRequest), (e) => e.statusCode === 409 && !e.message.includes("Duplicate entry"));
    assert.equal(notes.notifyEvent.mock.callCount(), 0);
});

// ======================= status transitions =======================

function stubFlow(row, { accept = "accepted", changed = true } = {}) {
    return {
        find: mock.method(Repo, "findMentorshipById", async () => row),
        accept: mock.method(Repo, "acceptMentorship", async () => accept),
        transition: mock.method(Repo, "transition", async () => changed),
    };
}

test("mentor accepts: PENDING -> ACTIVE, student notified, request notification settled", async () => {
    const w = stubFlow(mentorshipRow());

    assert.deepEqual(await Service.respond(MENTOR, 5, { action: "ACCEPT", response: "Glad to help" }), { id: 5, status: "ACTIVE" });

    assert.deepEqual(w.accept.mock.calls[0].arguments[0], { id: 5, mentorId: 10, response: "Glad to help" });
    assert.deepEqual(notes.settleByKey.mock.calls[0].arguments, ["MENTORSHIP:5:PENDING"]);
    const n = notes.notifyEvent.mock.calls[0].arguments[0];
    assert.deepEqual([n.type, n.recipientId, n.actorId, n.dedupeKey], ["MENTORSHIP_UPDATE", 1, 10, "MENTORSHIP:5:ACTIVE"]);
});

test("mentor declines: PENDING -> REJECTED with their reply", async () => {
    const w = stubFlow(mentorshipRow());
    assert.deepEqual(await Service.respond(MENTOR, 5, { action: "REJECT", response: "No time this term" }), { id: 5, status: "REJECTED" });
    assert.deepEqual(w.transition.mock.calls[0].arguments[0], { id: 5, from: "PENDING", to: "REJECTED", actorId: 10, response: "No time this term" });
    assert.equal(notes.notifyEvent.mock.calls[0].arguments[0].dedupeKey, "MENTORSHIP:5:REJECTED");
});

test("accepting respects the mentor's capacity and loses cleanly to a concurrent change", async () => {
    stubFlow(mentorshipRow(), { accept: "full" });
    await assert.rejects(Service.respond(MENTOR, 5, { action: "ACCEPT" }), (e) => e.statusCode === 400 && /maximum number of active mentees/.test(e.message));
    assert.equal(notes.notifyEvent.mock.callCount(), 0);

    mock.restoreAll();
    notes = stubNotifications(mock);
    stubFlow(mentorshipRow(), { accept: "stale" });
    await assert.rejects(Service.respond(MENTOR, 5, { action: "ACCEPT" }), { statusCode: 409 });
    assert.equal(notes.notifyEvent.mock.callCount(), 0);
});

test("only a PENDING request can be answered; an inactive student can't be accepted", async () => {
    for (const status of ["ACTIVE", "REJECTED", "CANCELLED", "COMPLETED"]) {
        const w = stubFlow(mentorshipRow({ status }));
        await assert.rejects(Service.respond(MENTOR, 5, { action: "ACCEPT" }), { statusCode: 409 }, status);
        await assert.rejects(Service.respond(MENTOR, 5, { action: "REJECT" }), { statusCode: 409 }, status);
        assert.equal(w.accept.mock.callCount() + w.transition.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
    const w = stubFlow(mentorshipRow({ mentee_status: "BLOCKED" }));
    await assert.rejects(Service.respond(MENTOR, 5, { action: "ACCEPT" }), { statusCode: 409 });
    assert.equal(w.accept.mock.callCount(), 0);
});

test("student cancels a pending request; it vanishes from the mentor's notifications", async () => {
    const w = stubFlow(mentorshipRow());
    assert.deepEqual(await Service.cancel(STUDENT, 5), { id: 5, status: "CANCELLED" });
    assert.deepEqual(w.transition.mock.calls[0].arguments[0], { id: 5, from: "PENDING", to: "CANCELLED", actorId: 1 });
    assert.deepEqual(notes.removeByKey.mock.calls[0].arguments, ["MENTORSHIP:5:PENDING"]);

    mock.restoreAll();
    notes = stubNotifications(mock);
    stubFlow(mentorshipRow({ status: "ACTIVE" }));
    await assert.rejects(Service.cancel(STUDENT, 5), { statusCode: 409 }); // an active mentorship is completed, not cancelled
});

test("either participant can complete an ACTIVE mentorship; the other one is told", async () => {
    for (const [viewer, other] of [[STUDENT, 10], [MENTOR, 1]]) {
        const w = stubFlow(mentorshipRow({ status: "ACTIVE" }));
        assert.deepEqual(await Service.complete(viewer, 5, { note: "Thank you!" }), { id: 5, status: "COMPLETED" });
        assert.deepEqual(w.transition.mock.calls[0].arguments[0], {
            id: 5, from: "ACTIVE", to: "COMPLETED", actorId: viewer.userId, closingNote: "Thank you!", markEnded: true,
        });
        assert.equal(notes.notifyEvent.mock.calls[0].arguments[0].recipientId, other);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }
    stubFlow(mentorshipRow({ status: "PENDING" }));
    await assert.rejects(Service.complete(STUDENT, 5, {}), { statusCode: 409 });
});

// ======================= acting only as yourself =======================

test("only the two participants can see or touch a mentorship; roles inside it are enforced", async () => {
    const w = stubFlow(mentorshipRow());
    mock.method(Repo, "findGoals", async () => []);
    mock.method(Repo, "findSessions", async () => []);
    mock.method(Repo, "findEvents", async () => []);

    // an outsider - indistinguishable from a mentorship that doesn't exist
    for (const attempt of [
        () => Service.getMentorship(OUTSIDER, 5),
        () => Service.respond(OUTSIDER, 5, { action: "ACCEPT" }),
        () => Service.cancel(OUTSIDER, 5),
        () => Service.complete(OUTSIDER, 5, {}),
        () => Service.addGoal(OUTSIDER, 5, { title: "Sneaky goal" }),
        () => Service.addSession(OUTSIDER, 5, { session_date: "2026-01-01", notes: "sneaky" }),
        () => Service.respond({ userId: 77, role: "ALUMNI" }, 5, { action: "ACCEPT" }),
    ]) {
        await assert.rejects(attempt(), { statusCode: 404 });
    }
    // the right people, the wrong side
    await assert.rejects(Service.respond(STUDENT, 5, { action: "ACCEPT" }), { statusCode: 403 });
    await assert.rejects(Service.cancel(MENTOR, 5), { statusCode: 403 });

    assert.equal(w.accept.mock.callCount() + w.transition.mock.callCount(), 0);
    assert.equal(notes.notifyEvent.mock.callCount(), 0);
});

test("missing and malformed ids", async () => {
    mock.method(Repo, "findMentorshipById", async () => undefined);
    await assert.rejects(Service.getMentorship(STUDENT, 999), { statusCode: 404 });
    for (const bad of ["abc", "0", "-1", "1.5"]) {
        await assert.rejects(Service.getMentorship(STUDENT, bad), { statusCode: 400 }, bad);
    }
});

// ======================= goals and sessions =======================

test("goals: either participant adds them while ACTIVE; the other is told once", async () => {
    stubFlow(mentorshipRow({ status: "ACTIVE" }));
    mock.method(Repo, "findGoals", async () => []);
    const create = mock.method(Repo, "createGoal", async () => 31);

    assert.deepEqual(await Service.addGoal(MENTOR, 5, { title: "Explain two projects" }), { id: 31 });
    assert.deepEqual(create.mock.calls[0].arguments, [5, "Explain two projects", 10]);
    const n = notes.notifyEvent.mock.calls[0].arguments[0];
    assert.deepEqual([n.recipientId, n.dedupeKey, n.extra], [1, "MENTORSHIP_GOAL:31:ADDED", "GOAL_ADDED|INTERVIEW_PREP|Explain two projects"]);
});

test("goals and sessions need an ACTIVE mentorship and respect their limits", async () => {
    for (const status of ["PENDING", "REJECTED", "CANCELLED", "COMPLETED"]) {
        stubFlow(mentorshipRow({ status }));
        const create = mock.method(Repo, "createGoal", async () => 1);
        await assert.rejects(Service.addGoal(STUDENT, 5, { title: "A goal" }), { statusCode: 409 }, status);
        await assert.rejects(Service.addSession(STUDENT, 5, { session_date: "2026-01-01", notes: "notes" }), { statusCode: 409 }, status);
        await assert.rejects(Service.setGoalStatus(STUDENT, 5, 1, { status: "DONE" }), { statusCode: 409 }, status);
        assert.equal(create.mock.callCount(), 0);
        mock.restoreAll();
        notes = stubNotifications(mock);
    }

    stubFlow(mentorshipRow({ status: "ACTIVE" }));
    mock.method(Repo, "findGoals", async () => Array.from({ length: LIMITS.MAX_GOALS }, (_, i) => ({ id: i })));
    await assert.rejects(Service.addGoal(STUDENT, 5, { title: "One too many" }), { statusCode: 400 });
});

test("marking a goal done: it must belong to this mentorship, and only a real change notifies", async () => {
    stubFlow(mentorshipRow({ status: "ACTIVE" }));
    const findGoal = mock.method(Repo, "findGoal", async (goalId) => (goalId === 31 ? { id: 31, title: "Explain two projects", status: "OPEN" } : undefined));
    const set = mock.method(Repo, "setGoalStatus", async () => 1);

    await assert.rejects(Service.setGoalStatus(STUDENT, 5, 999, { status: "DONE" }), { statusCode: 404 }); // goal of another mentorship
    assert.deepEqual(findGoal.mock.calls[0].arguments, [999, 5]);

    await Service.setGoalStatus(STUDENT, 5, 31, { status: "DONE" });
    assert.deepEqual(set.mock.calls[0].arguments, [31, 5, "DONE"]);
    assert.equal(notes.notifyEvent.mock.calls[0].arguments[0].dedupeKey, "MENTORSHIP_GOAL:31:DONE");

    set.mock.mockImplementation(async () => 0); // already done
    await Service.setGoalStatus(STUDENT, 5, 31, { status: "DONE" });
    await Service.setGoalStatus(STUDENT, 5, 31, { status: "OPEN" }); // reopening is quiet
    assert.equal(notes.notifyEvent.mock.callCount(), 1);
});

test("logging a session records who logged it and tells the other participant", async () => {
    stubFlow(mentorshipRow({ status: "ACTIVE" }));
    mock.method(Repo, "findSessions", async () => []);
    const create = mock.method(Repo, "createSession", async () => 41);

    await Service.addSession(STUDENT, 5, { session_date: "2026-01-15", duration_minutes: 45, notes: "Mock interview on arrays." });

    assert.deepEqual(create.mock.calls[0].arguments, [5, { sessionDate: "2026-01-15", durationMinutes: 45, notes: "Mock interview on arrays." }, 1]);
    const n = notes.notifyEvent.mock.calls[0].arguments[0];
    assert.deepEqual([n.recipientId, n.actorId, n.dedupeKey], [10, 1, "MENTORSHIP_SESSION:41"]);
});

// ======================= what participants see =======================

test("mentorship detail: public profile fields only, and 'who did it' is a side, never a user id", async () => {
    stubFlow(mentorshipRow({ status: "ACTIVE" }));
    mock.method(Repo, "findGoals", async () => [{ id: 1, title: "Goal", status: "DONE", created_by: 10, created_at: "t", completed_at: "t2" }]);
    mock.method(Repo, "findSessions", async () => [{ id: 2, session_date: "2026-01-15", duration_minutes: 45, notes: "n", created_by: 1, created_at: "t" }]);
    mock.method(Repo, "findEvents", async () => [
        { actor_id: 1, from_status: null, to_status: "PENDING", created_at: "t" },
        { actor_id: 10, from_status: "PENDING", to_status: "ACTIVE", created_at: "t" },
    ]);

    const detail = await Service.getMentorship(STUDENT, 5);

    assert.deepEqual(Object.keys(detail).sort(), [
        "actions", "closing_note", "created_at", "ended_at", "goals", "history", "id", "mentee", "mentor",
        "message", "my_role", "response", "sessions", "started_at", "status", "topic",
    ]);
    assert.deepEqual(Object.keys(detail.mentor).sort(), ["company", "designation", "full_name", "is_verified_alumni", "profile_photo", "user_id"]);
    assert.deepEqual(Object.keys(detail.mentee).sort(), ["batch_year", "branch", "full_name", "profile_photo", "user_id"]);
    assert.equal(detail.my_role, "mentee");
    assert.deepEqual(detail.actions, ["ADD_GOAL", "LOG_SESSION", "COMPLETE"]);
    assert.equal(detail.goals[0].added_by, "mentor");
    assert.equal(detail.sessions[0].logged_by, "mentee");
    assert.deepEqual(detail.history.map((h) => [h.status, h.by]), [["PENDING", "mentee"], ["ACTIVE", "mentor"]]);
    const json = JSON.stringify(detail);
    for (const secret of ["secret.test", "EN999", "created_by", "actor_id"]) assert.equal(json.includes(secret), false, secret);

    assert.equal((await Service.getMentorship(MENTOR, 5)).my_role, "mentor");
});

test("the actions offered match what each side may do right now", () => {
    const { actionsFor } = Service;
    assert.deepEqual(actionsFor(mentorshipRow({ status: "PENDING" }), 10), ["ACCEPT", "REJECT"]);
    assert.deepEqual(actionsFor(mentorshipRow({ status: "PENDING" }), 1), ["CANCEL"]);
    assert.deepEqual(actionsFor(mentorshipRow({ status: "ACTIVE" }), 1), ["ADD_GOAL", "LOG_SESSION", "COMPLETE"]);
    assert.deepEqual(actionsFor(mentorshipRow({ status: "ACTIVE" }), 10), ["ADD_GOAL", "LOG_SESSION", "COMPLETE"]);
    for (const status of ["REJECTED", "CANCELLED", "COMPLETED"]) assert.deepEqual(actionsFor(mentorshipRow({ status }), 10), []);
    assert.deepEqual(actionsFor(mentorshipRow(), 55), []);
});

// ======================= discovery and matching service =======================

test("matches are computed from the signed-in user's own data, exclude themselves, and explain the score", async () => {
    const find = mock.method(Repo, "findMentors", async () => [mentorRow(), mentorRow({ user_id: 11, profile_id: 41, full_name: "No Match", active_mentees: 0 })]);
    mock.method(Repo, "findTagsForMentors", async () => ({ 10: { topics: ["INTERVIEW_PREP"], areas: ["Computer Applications"] }, 11: { topics: ["HIGHER_STUDIES"], areas: [] } }));
    mock.method(Repo, "findSkillsForProfiles", async () => ({ 40: [{ key: "react", name: "React" }, { key: "aws", name: "AWS" }] }));
    mock.method(Repo, "findOpenToMentorship", async () => new Set([10]));
    const gap = stubContext({ connected: new Set([10]), missing: [{ skill_key: "aws", skill: "AWS" }, { skill_key: "docker", skill: "Docker" }] });

    const result = await Service.getMatches(STUDENT, V.matchQuerySchema.parse({ topic: "INTERVIEW_PREP", skills: "react.js" }));

    assert.equal(find.mock.calls[0].arguments[0].excludeUserId, 1);
    assert.deepEqual(gap.mock.calls[0].arguments[0], STUDENT); // the viewer's own skill gap
    assert.deepEqual(result.criteria.requested_skills, ["React"]); // "react.js" resolved to the canonical skill
    assert.deepEqual(result.criteria.skill_gap_considered, ["AWS", "Docker"]);
    assert.equal(result.criteria.your_branch, "Computer Applications");
    assert.equal(result.mentors_considered, 2);
    assert.equal(result.matches.length, 1); // the mentor who met nothing is not "recommended"
    const [m] = result.matches;
    assert.deepEqual(m.match.reasons.map((r) => r.code), ["TOPIC", "REQUESTED_SKILL", "GAP_SKILL", "OPEN_TO", "AREA", "CONNECTED"]);
    assert.equal(m.match.score, 30 + 10 + 8 + 10 + 10 + 10);
    assert.deepEqual(m.skills, ["React", "AWS"]);
    assert.equal(JSON.stringify(result).includes("secret.test"), false);
});

test("a mentor page is only for ACTIVE alumni mentors, and shows where the viewer stands", async () => {
    stubMentor();
    stubContext({ connected: new Set([10]) });
    mock.method(Repo, "findOpenBetween", async () => ({ id: 5, status: "PENDING" }));

    const page = await Service.getMentor(STUDENT, "10");
    assert.deepEqual(page.viewer, { is_self: false, is_connected: true, can_request: true, open_mentorship: { id: 5, status: "PENDING" } });
    assert.ok(page.match.score > 0);

    const own = await Service.getMentor(MENTOR, 10);
    assert.deepEqual(own.viewer, { is_self: true, is_connected: false, can_request: false, open_mentorship: null });
    assert.equal(own.match, null);

    for (const row of [undefined, mentorRow({ status: "BLOCKED" }), mentorRow({ role: "STUDENT" })]) {
        mock.restoreAll();
        stubMentor({ row });
        await assert.rejects(Service.getMentor(STUDENT, 10), { statusCode: 404 });
    }
});

test("directory: filters are passed down with skills resolved to every spelling", async () => {
    const find = mock.method(Repo, "findMentors", async () => [mentorRow()]);
    mock.method(Repo, "countMentors", async () => 13);
    mock.method(Repo, "findTagsForMentors", async () => ({}));
    mock.method(Repo, "findSkillsForProfiles", async () => ({}));
    mock.method(Repo, "findOpenToMentorship", async () => new Set());

    const result = await Service.listMentors(STUDENT, V.listMentorsSchema.parse({ q: "backend", topic: "INTERVIEW_PREP", skills: "React", page: "2", limit: "12" }));

    assert.deepEqual(find.mock.calls[0].arguments, [
        { excludeUserId: 1, q: "backend", topic: "INTERVIEW_PREP", skillKeyGroups: [["react", "reactjs"]] }, 12, 12,
    ]);
    assert.deepEqual(result.pagination, { page: 2, limit: 12, total: 13, totalPages: 2 });
    assert.deepEqual([result.can_request, result.can_be_mentor], [true, false]);
});

// ======================= the SQL that actually runs =======================

test("only ACTIVE alumni who are accepting are listed as mentors; every filter is bound", () => {
    const { whereSql, params } = Repo.buildMentorFilter({ excludeUserId: 1, q: "dev 50%", topic: "INTERVIEW_PREP", skillKeyGroups: [["react", "reactjs"]] });
    assert.match(whereSql, /u\.status = 'ACTIVE' AND u\.role = 'ALUMNI' AND mp\.is_accepting = 1/);
    assert.match(whereSql, /mp\.user_id <> \?/);
    assert.match(whereSql, /mt\.kind = 'TOPIC' AND mt\.value = \?/);
    assert.match(whereSql, /ps\.skill_key IN \(\?, \?\)/);
    assert.equal((whereSql.match(/\?/g) || []).length, params.length);
    assert.ok(params.includes("%50\\%%")); // wildcard escaped
    assert.equal(whereSql.includes("email"), false);
});

test("dashboards are bound to the viewer and hide mentorships whose other party is not ACTIVE", () => {
    const mine = Repo.buildMentorshipFilter(1, { box: "mentee", status: "ACTIVE" });
    assert.match(mine.whereSql, /m\.mentee_id = \? AND mru\.status = 'ACTIVE'/);
    assert.deepEqual(mine.params, [1, "ACTIVE"]);
    const asMentor = Repo.buildMentorshipFilter(10, { box: "mentor" });
    assert.match(asMentor.whereSql, /m\.mentor_id = \? AND meu\.status = 'ACTIVE'/);
    assert.deepEqual(asMentor.params, [10]);
});

function fakeConnection(onExecute) {
    const log = [];
    mock.method(pool, "getConnection", async () => ({
        beginTransaction: async () => log.push("begin"),
        commit: async () => log.push("commit"),
        rollback: async () => log.push("rollback"),
        release: () => log.push("release"),
        execute: async (sql, params) => {
            const flat = sql.replace(/\s+/g, " ").trim();
            log.push(flat);
            return onExecute(flat, params);
        },
    }));
    return log;
}

test("accepting locks the mentor's capacity row, so two accepts can't both pass the limit", async () => {
    const run = async ({ max, active, affected }) => {
        const log = fakeConnection((sql) => {
            if (sql.includes("FOR UPDATE")) return [[{ max_active_mentees: max }]];
            if (sql.startsWith("SELECT COUNT(*)")) return [[{ active }]];
            if (sql.startsWith("UPDATE mentorships")) return [{ affectedRows: affected }];
            return [{}];
        });
        const outcome = await Repo.acceptMentorship({ id: 5, mentorId: 10, response: "ok" });
        mock.restoreAll();
        return { outcome, log };
    };

    const full = await run({ max: 1, active: 1, affected: 1 });
    assert.equal(full.outcome, "full");
    assert.equal(full.log.some((l) => l.startsWith("UPDATE mentorships")), false); // never even tried

    const stale = await run({ max: 3, active: 0, affected: 0 });
    assert.equal(stale.outcome, "stale");
    assert.equal(stale.log.some((l) => l.includes("mentorship_events")), false);

    const accepted = await run({ max: 3, active: 2, affected: 1 });
    assert.equal(accepted.outcome, "accepted");
    assert.match(accepted.log[1], /FROM mentor_profiles WHERE user_id = \? FOR UPDATE/); // lock first
    assert.ok(accepted.log.some((l) => /UPDATE mentorships SET status = 'ACTIVE'.*WHERE id = \? AND status = 'PENDING'/.test(l)));
    assert.deepEqual([accepted.log[0], accepted.log.at(-2), accepted.log.at(-1)], ["begin", "commit", "release"]);
});

test("other status changes are compare-and-set and write history only when they happen", async () => {
    const seen = [];
    fakeConnection((sql, params) => { seen.push({ sql, params }); return [{ affectedRows: 1 }]; });
    assert.equal(await Repo.transition({ id: 5, from: "ACTIVE", to: "COMPLETED", actorId: 1, closingNote: "bye", markEnded: true }), true);
    assert.equal(seen[0].sql, "UPDATE mentorships SET status = ?, closing_note = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?");
    assert.deepEqual(seen[0].params, ["COMPLETED", "bye", 5, "ACTIVE"]);

    mock.restoreAll();
    const log = fakeConnection(() => [{ affectedRows: 0 }]);
    assert.equal(await Repo.transition({ id: 5, from: "PENDING", to: "CANCELLED", actorId: 1 }), false);
    assert.equal(log.some((l) => l.includes("mentorship_events")), false);
});

test("becoming a mentor sets 'Open to: Mentorship' and replaces topics/areas in one transaction", async () => {
    const log = fakeConnection(() => [{}]);
    await Repo.upsertMentorProfile(10, { bio: "b", availability: "a", maxActiveMentees: 2, isAccepting: true, topics: ["INTERVIEW_PREP"], areas: ["CA"] });

    assert.ok(log.some((l) => l.startsWith("INSERT INTO mentor_profiles") && l.includes("ON DUPLICATE KEY UPDATE")));
    assert.ok(log.some((l) => l.startsWith("DELETE FROM mentor_tags")));
    assert.equal(log.filter((l) => l.startsWith("INSERT INTO mentor_tags")).length, 2);
    assert.ok(log.some((l) => l.startsWith("INSERT IGNORE INTO profile_open_to") && l.includes("'MENTORSHIP'")));
    assert.deepEqual([log[0], log.at(-2)], ["begin", "commit"]);
});

test("mentor and mentorship queries select no private user columns", async () => {
    const calls = [];
    mock.method(pool, "execute", async (sql) => { calls.push(sql.replace(/\s+/g, " ")); return [[{ total: 0 }], []]; });
    await Repo.findMentors({ excludeUserId: 1 }, 12, 0);
    await Repo.findMentorByUserId(10);
    await Repo.findMentorshipById(5);
    await Repo.findMentorships(1, { box: "mentee" }, 10, 0);

    for (const sql of calls) {
        const select = sql.slice(sql.indexOf("SELECT"), sql.lastIndexOf(" FROM mentor"));
        for (const col of ["email", "enrollment", "mobile", "dob", "password"]) assert.equal(select.includes(col), false, `${col}: ${sql.slice(0, 50)}`);
    }
});

// ======================= HTTP API =======================

let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/mentorship", mentorshipRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/mentorship`;
});
after(() => server.close());

const headers = (userId, role) => ({
    Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
    "Content-Type": "application/json",
});
// the session row decides who you are and your role - not the token's claims
const session = (userId, role, status = "ACTIVE") =>
    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: userId, role, status }));
const send = (method, path, who, body) =>
    fetch(`${base}${path}`, { method, headers: headers(who.userId, who.role), body: body === undefined ? undefined : JSON.stringify(body) });

test("HTTP: every mentorship endpoint requires a signed-in, ACTIVE user", async () => {
    const routes = [
        ["GET", "/mentor-profile"], ["PUT", "/mentor-profile"], ["GET", "/mentors"], ["GET", "/matches"], ["GET", "/mentors/10"],
        ["GET", "/requests"], ["POST", "/requests"], ["GET", "/requests/5"], ["PATCH", "/requests/5/respond"],
        ["PATCH", "/requests/5/cancel"], ["PATCH", "/requests/5/complete"], ["POST", "/requests/5/goals"],
        ["PATCH", "/requests/5/goals/1"], ["POST", "/requests/5/sessions"],
    ];
    for (const [method, path] of routes) assert.equal((await fetch(`${base}${path}`, { method })).status, 401, `${method} ${path}`);

    session(1, "STUDENT", "BLOCKED");
    assert.equal((await send("GET", "/mentors", STUDENT)).status, 401);
});

test("HTTP: becoming a mentor follows the session's role, not the token's claim", async () => {
    const upsert = mock.method(Repo, "upsertMentorProfile", async () => {});
    stubMentor();

    session(1, "STUDENT"); // really a student, token claims ALUMNI
    assert.equal((await send("PUT", "/mentor-profile", { userId: 1, role: "ALUMNI" }, validProfile)).status, 403);
    assert.equal(upsert.mock.callCount(), 0);

    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 10, role: "ALUMNI", status: "ACTIVE" }));
    const ok = await send("PUT", "/mentor-profile", MENTOR, validProfile);
    assert.equal(ok.status, 200);
    assert.equal(upsert.mock.calls[0].arguments[0], 10);
    assert.equal((await send("PUT", "/mentor-profile", MENTOR, { ...validProfile, user_id: 3 })).status, 400);
});

test("HTTP: a student requests mentorship as themselves; alumni can't; the mentee can't be forged", async () => {
    const w = stubMentor();

    session(1, "STUDENT");
    const res = await send("POST", "/requests", STUDENT, validRequest);
    assert.equal(res.status, 201);
    assert.deepEqual((await res.json()).data, { id: 77 });
    assert.equal(w.create.mock.calls[0].arguments[0].menteeId, 1);
    assert.equal((await send("POST", "/requests", STUDENT, { ...validRequest, mentee_id: 55 })).status, 400);
    assert.equal((await send("POST", "/requests", STUDENT, { ...validRequest, message: "short" })).status, 400);

    mock.method(authRepository, "findActiveSession", async () => ({ id: 1, user_id: 10, role: "ALUMNI", status: "ACTIVE" }));
    assert.equal((await send("POST", "/requests", MENTOR, validRequest)).status, 403);
    assert.equal(w.create.mock.callCount(), 1);
});

test("HTTP: respond / cancel / goals enforce who is acting", async () => {
    stubFlow(mentorshipRow());
    mock.method(Repo, "findGoals", async () => []);
    mock.method(Repo, "findSessions", async () => []);
    mock.method(Repo, "findEvents", async () => []);

    session(55, "STUDENT"); // not part of it
    assert.equal((await send("GET", "/requests/5", OUTSIDER)).status, 404);
    assert.equal((await send("PATCH", "/requests/5/respond", OUTSIDER, { action: "ACCEPT" })).status, 404);
    assert.equal((await send("PATCH", "/requests/5/cancel", OUTSIDER)).status, 404);

    session(1, "STUDENT"); // the student can't accept their own request, nor add goals before it is active
    assert.equal((await send("PATCH", "/requests/5/respond", STUDENT, { action: "ACCEPT" })).status, 403);
    assert.equal((await send("POST", "/requests/5/goals", STUDENT, { title: "Too early" })).status, 409);

    session(10, "ALUMNI"); // the mentor can't cancel it, but can accept
    assert.equal((await send("PATCH", "/requests/5/cancel", MENTOR)).status, 403);
    const ok = await send("PATCH", "/requests/5/respond", MENTOR, { action: "ACCEPT", response: "Sure" });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).data, { id: 5, status: "ACTIVE" });
    assert.equal((await send("PATCH", "/requests/5/respond", MENTOR, { action: "APPROVE" })).status, 400);
    assert.equal((await send("PATCH", "/requests/abc/respond", MENTOR, { action: "ACCEPT" })).status, 400);
});

test("HTTP: matching can't be requested for someone else", async () => {
    session(1, "STUDENT");
    const gap = stubContext();
    mock.method(Repo, "findMentors", async () => []);
    mock.method(Repo, "findTagsForMentors", async () => ({}));
    mock.method(Repo, "findSkillsForProfiles", async () => ({}));
    mock.method(Repo, "findOpenToMentorship", async () => new Set());

    assert.equal((await send("GET", "/matches?user_id=9", STUDENT)).status, 400);
    assert.equal(gap.mock.callCount(), 0);

    const res = await send("GET", "/matches?topic=INTERVIEW_PREP", STUDENT);
    assert.equal(res.status, 200);
    assert.equal(gap.mock.calls[0].arguments[0].userId, 1);
    assert.equal((await res.json()).data.criteria.topic, "INTERVIEW_PREP");
});
