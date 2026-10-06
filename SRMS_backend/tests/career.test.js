process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const authRepository = require("../src/modules/auth/auth.repository");
const CareerRepository = require("../src/modules/career/career.repository");
const CareerService = require("../src/modules/career/career.service");
const { createRequestSchema, respondSchema, listRequestsSchema, eligibleAlumniSchema } = require("../src/modules/career/career.validation");
const { RESPOND_ACTIONS, CANCELLABLE_FROM, MAX_PENDING_PER_REQUESTER } = require("../src/modules/career/career.constants");
const careerRoutes = require("../src/modules/career/career.route");
const ConnectionRepository = require("../src/modules/connection/connection.repository");
const JobRepository = require("../src/modules/job/job.repository");
const NotificationRepository = require("../src/modules/notification/notification.repository");
const NotificationService = require("../src/modules/notification/notification.service");
const globalErrorHandler = require("../src/middlewares/errorMiddleware");
const stubNotifications = require("./helpers/stubNotifications");
const registry = require("../src/socket/socketRegistry");

let stubs;
beforeEach(() => {
    stubs = stubNotifications(mock);
});
afterEach(() => mock.restoreAll());

const STUDENT = { userId: 1, role: "STUDENT" };
const ALUMNUS = { userId: 10, role: "ALUMNI" };
const OUTSIDER = { userId: 55, role: "STUDENT" };

const FIT = "I built two Node.js services in my final-year project and would love to join.";
const referralBody = { type: "REFERRAL", alumni_id: 10, job_id: 7, message: FIT };
const reviewBody = { type: "RESUME_REVIEW", alumni_id: 10, message: "Could you review my resume please?", resume_url: "https://drive.example/cv.pdf" };
const questionBody = { type: "QUESTION", alumni_id: 10, message: "How should I prepare for system design interviews?" };

// a request row as the repository returns it, with sensitive extras a careless query could add
const requestRow = (over = {}) => ({
    id: 3,
    type: "REFERRAL",
    requester_id: 1,
    alumni_id: 10,
    job_id: 7,
    message: FIT,
    resume_url: "https://drive.example/cv.pdf",
    response: null,
    status: "PENDING",
    responded_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    requester_name: "Aarav Sharma",
    requester_photo: null,
    requester_designation: null,
    requester_company: null,
    requester_branch: "Computer Applications",
    requester_batch_year: 2025,
    requester_role: "STUDENT",
    requester_status: "ACTIVE",
    alumni_name: "Arjun Verma",
    alumni_photo: "a.jpg",
    alumni_designation: "Engineer",
    alumni_company: "Acme",
    alumni_role: "ALUMNI",
    alumni_status: "ACTIVE",
    job_title: "Backend Engineer",
    job_company: "Acme Labs",
    job_location: "Noida",
    job_status: "OPEN",
    requester_email: "aarav@secret.test",
    requester_enrollment: "EN123",
    alumni_mobile: "9999999999",
    ...over,
});

const openJob = (over = {}) => ({ id: 7, poster_id: 10, title: "Backend Engineer", company: "Acme Labs", location: "Noida", status: "OPEN", poster_status: "ACTIVE", poster_role: "ALUMNI", ...over });

// the happy-path world: an ACTIVE alumnus, an ACCEPTED connection, an open job
// (an explicitly passed `undefined` means "nothing found", so defaults only apply to absent keys)
function happyWorld(opts = {}) {
    const pick = (key, fallback) => (key in opts ? opts[key] : fallback);
    const connection = pick("connection", { id: 1, status: "ACCEPTED" });
    const target = pick("target", { id: 10, role: "ALUMNI", status: "ACTIVE" });
    const job = pick("job", openJob());
    const pending = pick("pending", 0);
    return {
        target: mock.method(CareerRepository, "findUserBrief", async () => target),
        connection: mock.method(ConnectionRepository, "findConnection", async () => connection),
        openTo: mock.method(CareerRepository, "hasOpenTo", async () => false),
        job: mock.method(JobRepository, "findJobById", async () => job),
        pending: mock.method(CareerRepository, "countPendingByRequester", async () => pending),
        create: mock.method(CareerRepository, "createRequest", async () => 99),
    };
}

// ======================= validation =======================

test("create: valid referral, resume review and question payloads", () => {
    assert.equal(createRequestSchema.safeParse(referralBody).success, true);
    assert.equal(createRequestSchema.safeParse(reviewBody).success, true);
    assert.equal(createRequestSchema.safeParse(questionBody).success, true);
    assert.equal(createRequestSchema.safeParse({ ...referralBody, resume_url: "https://drive.example/cv" }).success, true); // optional on referrals
});

test("create: per-type rules (job link, resume link, note length)", () => {
    const fails = (body) => createRequestSchema.safeParse(body).success === false;
    assert.equal(fails({ ...referralBody, job_id: undefined }), true); // a referral is always for a job
    assert.equal(fails({ ...questionBody, job_id: 7 }), true);
    assert.equal(fails({ ...reviewBody, job_id: 7 }), true);
    assert.equal(fails({ ...reviewBody, resume_url: undefined }), true);
    assert.equal(fails({ ...questionBody, resume_url: "https://drive.example/cv" }), true);
    assert.equal(fails({ ...referralBody, message: "pls refer me" }), true); // fit note too short
    assert.equal(fails({ ...referralBody, message: "x".repeat(601) }), true);
    assert.equal(fails({ ...questionBody, message: "x".repeat(1001) }), true);
    assert.equal(fails({ ...questionBody, type: "MENTORSHIP" }), true);
    assert.equal(fails({ ...questionBody, alumni_id: "10" }), true);
    assert.equal(fails({ ...questionBody, alumni_id: -1 }), true);
});

test("create: the resume link must be a safe https URL", () => {
    for (const bad of ["javascript:alert(1)", "http://drive.example/cv", "https://u:p@drive.example/cv", "drive.example/cv"]) {
        assert.equal(createRequestSchema.safeParse({ ...reviewBody, resume_url: bad }).success, false, bad);
    }
});

test("create: nobody can name the requester, a status or an id in the body", () => {
    for (const forged of [{ requester_id: 5 }, { student_id: 5 }, { status: "ACCEPTED" }, { id: 1 }, { response: "yes" }]) {
        assert.equal(createRequestSchema.safeParse({ ...questionBody, ...forged }).success, false, JSON.stringify(forged));
    }
});

test("respond / list / eligible-alumni query validation", () => {
    assert.equal(respondSchema.parse({ action: "ACCEPT", response: "  " }).response, undefined);
    assert.equal(respondSchema.safeParse({ action: "CANCEL" }).success, false); // cancelling is the student's endpoint
    assert.equal(respondSchema.safeParse({ action: "ACCEPT", status: "COMPLETED" }).success, false);
    assert.equal(respondSchema.safeParse({ action: "ANSWER", response: "x".repeat(2001) }).success, false);

    const q = listRequestsSchema.parse({});
    assert.deepEqual([q.box, q.page, q.limit], ["sent", 1, 10]);
    assert.equal(listRequestsSchema.safeParse({ box: "all" }).success, false);
    assert.equal(listRequestsSchema.safeParse({ limit: "500" }).success, false);
    assert.equal(listRequestsSchema.safeParse({ status: "DONE" }).success, false);

    assert.equal(eligibleAlumniSchema.safeParse({ type: "REFERRAL" }).success, false);
    assert.equal(eligibleAlumniSchema.parse({ type: "REFERRAL", job_id: "7" }).job_id, 7);
    assert.equal(eligibleAlumniSchema.safeParse({ type: "QUESTION" }).success, true);
});

// ======================= who can ask whom =======================

test("a student with an ACCEPTED connection can request a referral; the alumnus is notified", async () => {
    const w = happyWorld();

    const result = await CareerService.createRequest(STUDENT, createRequestSchema.parse(referralBody));

    assert.deepEqual(result, { id: 99 });
    assert.deepEqual(w.create.mock.calls[0].arguments[0], {
        type: "REFERRAL", requesterId: 1, alumniId: 10, jobId: 7, message: FIT, resumeUrl: undefined,
    });
    assert.deepEqual(stubs.notifyCareerRequest.mock.calls[0].arguments[0], {
        requestId: 99, requesterId: 1, alumniId: 10, requestType: "REFERRAL", text: "Backend Engineer at Acme Labs",
    });
});

test("only students can request; alumni and admins are refused before anything is looked up", async () => {
    const w = happyWorld();
    for (const viewer of [ALUMNUS, { userId: 2, role: "ADMIN" }]) {
        await assert.rejects(CareerService.createRequest(viewer, referralBody), { statusCode: 403 });
    }
    assert.equal(w.target.mock.callCount(), 0);
    assert.equal(w.create.mock.callCount(), 0);
});

test("you can't send a request to yourself", async () => {
    const w = happyWorld();
    await assert.rejects(CareerService.createRequest(STUDENT, { ...questionBody, alumni_id: 1 }), { statusCode: 400 });
    assert.equal(w.create.mock.callCount(), 0);
});

test("the person asked must be an ACTIVE alumnus (students, blocked or missing users look like 'not found')", async () => {
    for (const target of [undefined, { id: 10, role: "STUDENT", status: "ACTIVE" }, { id: 10, role: "ADMIN", status: "ACTIVE" }, { id: 10, role: "ALUMNI", status: "BLOCKED" }, { id: 10, role: "ALUMNI", status: "PENDING" }]) {
        const w = happyWorld({ target });
        await assert.rejects(CareerService.createRequest(STUDENT, referralBody), { statusCode: 404 }, JSON.stringify(target));
        assert.equal(w.create.mock.callCount(), 0);
        mock.restoreAll();
        stubs = stubNotifications(mock);
    }
});

test("referrals and resume reviews need an ACCEPTED connection", async () => {
    for (const connection of [undefined, { status: "PENDING" }, { status: "REJECTED" }, { status: "REMOVED" }, { status: "CANCELLED" }]) {
        const w = happyWorld({ connection });
        w.openTo.mock.mockImplementation(async () => true); // being "open to" is not enough for these
        await assert.rejects(CareerService.createRequest(STUDENT, referralBody), { statusCode: 403 });
        await assert.rejects(CareerService.createRequest(STUDENT, reviewBody), { statusCode: 403 });
        assert.equal(w.create.mock.callCount(), 0);
        assert.equal(stubs.notifyCareerRequest.mock.callCount(), 0);
        mock.restoreAll();
        stubs = stubNotifications(mock);
    }
});

test("a question can also go to an alumnus who opted in to mentorship, connected or not", async () => {
    const w = happyWorld({ connection: undefined });

    await assert.rejects(CareerService.createRequest(STUDENT, questionBody), { statusCode: 403 }); // not opted in

    w.openTo.mock.mockImplementation(async () => true);
    assert.deepEqual(await CareerService.createRequest(STUDENT, questionBody), { id: 99 });
    assert.deepEqual(w.openTo.mock.calls.at(-1).arguments, [10, "MENTORSHIP"]);
    assert.equal(w.create.mock.calls[0].arguments[0].jobId, null);
});

test("a referral needs a job that is open and visible", async () => {
    const cases = [
        [undefined, 404],
        [openJob({ status: "DELETED" }), 404],
        [openJob({ poster_status: "BLOCKED" }), 404],
        [openJob({ status: "CLOSED" }), 400],
    ];
    for (const [job, code] of cases) {
        const w = happyWorld({ job });
        await assert.rejects(CareerService.createRequest(STUDENT, referralBody), { statusCode: code });
        assert.equal(w.create.mock.callCount(), 0);
        mock.restoreAll();
        stubs = stubNotifications(mock);
    }
});

test("outstanding requests are capped", async () => {
    const w = happyWorld({ pending: MAX_PENDING_PER_REQUESTER });
    await assert.rejects(CareerService.createRequest(STUDENT, questionBody), { statusCode: 400 });
    assert.equal(w.create.mock.callCount(), 0);
});

// ======================= duplicate prevention =======================

test("a duplicate active request (unique key) is a 409 and notifies nobody", async () => {
    const w = happyWorld();
    w.create.mock.mockImplementation(async () => {
        throw Object.assign(new Error("Duplicate entry 'REFERRAL-1-10-7-1'"), { code: "ER_DUP_ENTRY" });
    });

    await assert.rejects(
        CareerService.createRequest(STUDENT, referralBody),
        (err) => err.statusCode === 409 && /already have an active referral/.test(err.message) && !err.message.includes("Duplicate entry")
    );
    assert.equal(stubs.notifyCareerRequest.mock.callCount(), 0);
});

test("other database errors are not disguised as duplicates", async () => {
    const w = happyWorld();
    w.create.mock.mockImplementation(async () => { throw Object.assign(new Error("connection lost"), { code: "ECONNRESET" }); });
    await assert.rejects(CareerService.createRequest(STUDENT, referralBody), { code: "ECONNRESET" });
});

test("the eligible list flags alumni who already have an active request for that job", async () => {
    mock.method(JobRepository, "findJobById", async () => openJob());
    const find = mock.method(CareerRepository, "findEligibleAlumni", async () => [
        { user_id: 10, full_name: "Arjun", profile_photo: null, designation: "Eng", company: "Acme Labs", is_job_poster: 1, same_company: 1, is_open_to: 0, has_active_request: 1, email: "x@secret.test" },
    ]);

    const result = await CareerService.listEligibleAlumni(STUDENT, { type: "REFERRAL", job_id: 7 });

    assert.deepEqual(find.mock.calls[0].arguments, [1, { type: "REFERRAL", intent: "REFERRALS", jobId: 7, jobPosterId: 10, jobCompany: "Acme Labs" }]);
    assert.deepEqual(result.alumni[0], {
        user_id: 10, full_name: "Arjun", profile_photo: null, designation: "Eng", company: "Acme Labs",
        is_verified_alumni: true, is_job_poster: true, same_company: true, is_open_to: false, has_active_request: true,
    });
    assert.equal(result.can_request, true);
    assert.equal(JSON.stringify(result).includes("secret.test"), false);
});

// ======================= status transitions =======================

function forRespond(row, { connection = { status: "ACCEPTED" }, changed = true } = {}) {
    return {
        find: mock.method(CareerRepository, "findRequestById", async () => row),
        connection: mock.method(ConnectionRepository, "findConnection", async () => connection),
        transition: mock.method(CareerRepository, "transition", async () => changed),
    };
}

test("the transition table is exactly what is documented", () => {
    assert.deepEqual(Object.keys(RESPOND_ACTIONS.REFERRAL), ["ACCEPT", "REJECT", "COMPLETE"]);
    assert.deepEqual(Object.keys(RESPOND_ACTIONS.RESUME_REVIEW), ["ACCEPT", "REJECT", "COMPLETE"]);
    assert.deepEqual(Object.keys(RESPOND_ACTIONS.QUESTION), ["ANSWER", "REJECT"]);
    assert.deepEqual(CANCELLABLE_FROM, { REFERRAL: ["PENDING", "ACCEPTED"], RESUME_REVIEW: ["PENDING", "ACCEPTED"], QUESTION: ["PENDING"] });
});

test("alumnus accepts a referral: PENDING -> ACCEPTED, student notified, request notification settled", async () => {
    const w = forRespond(requestRow());

    const result = await CareerService.respond(ALUMNUS, 3, { action: "ACCEPT", response: "Happy to refer you" });

    assert.deepEqual(result, { id: 3, status: "ACCEPTED" });
    assert.deepEqual(w.transition.mock.calls[0].arguments[0], {
        id: 3, from: "PENDING", to: "ACCEPTED", actorId: 10, response: "Happy to refer you", markResponded: true,
    });
    assert.deepEqual(stubs.markCareerRequestHandled.mock.calls[0].arguments, [3]);
    assert.deepEqual(stubs.notifyCareerUpdate.mock.calls[0].arguments[0], {
        requestId: 3, recipientId: 1, actorId: 10, requestType: "REFERRAL", status: "ACCEPTED", text: "Backend Engineer at Acme Labs",
    });
});

test("every allowed alumnus action moves to the right status", async () => {
    const cases = [
        ["REFERRAL", "PENDING", "REJECT", "REJECTED"],
        ["REFERRAL", "ACCEPTED", "COMPLETE", "COMPLETED"],
        ["RESUME_REVIEW", "PENDING", "ACCEPT", "ACCEPTED"],
        ["RESUME_REVIEW", "ACCEPTED", "COMPLETE", "COMPLETED"],
        ["QUESTION", "PENDING", "ANSWER", "ANSWERED"],
        ["QUESTION", "PENDING", "REJECT", "REJECTED"],
    ];
    for (const [type, status, action, to] of cases) {
        const w = forRespond(requestRow({ type, status, job_id: type === "REFERRAL" ? 7 : null }));
        const result = await CareerService.respond(ALUMNUS, 3, { action, response: "A proper, helpful response." });
        assert.equal(result.status, to, `${type} ${status} ${action}`);
        assert.equal(w.transition.mock.calls[0].arguments[0].from, status);
        assert.equal(stubs.notifyCareerUpdate.mock.calls.at(-1).arguments[0].status, to);
        mock.restoreAll();
        stubs = stubNotifications(mock);
    }
});

test("invalid transitions are refused and change nothing", async () => {
    const cases = [
        ["REFERRAL", "PENDING", "COMPLETE", 409], // must accept first
        ["REFERRAL", "ACCEPTED", "ACCEPT", 409],
        ["REFERRAL", "ACCEPTED", "REJECT", 409],
        ["REFERRAL", "REJECTED", "ACCEPT", 409],
        ["REFERRAL", "CANCELLED", "ACCEPT", 409],
        ["REFERRAL", "COMPLETED", "COMPLETE", 409],
        ["REFERRAL", "PENDING", "ANSWER", 400], // not an action for referrals
        ["QUESTION", "PENDING", "ACCEPT", 400],
        ["QUESTION", "PENDING", "COMPLETE", 400],
        ["QUESTION", "ANSWERED", "ANSWER", 409],
    ];
    for (const [type, status, action, code] of cases) {
        const w = forRespond(requestRow({ type, status }));
        await assert.rejects(
            CareerService.respond(ALUMNUS, 3, { action, response: "A proper, helpful response." }),
            { statusCode: code },
            `${type} ${status} ${action}`
        );
        assert.equal(w.transition.mock.callCount(), 0);
        assert.equal(stubs.notifyCareerUpdate.mock.callCount(), 0);
        mock.restoreAll();
        stubs = stubNotifications(mock);
    }
});

test("answering a question requires an actual answer", async () => {
    const w = forRespond(requestRow({ type: "QUESTION", job_id: null }));
    await assert.rejects(CareerService.respond(ALUMNUS, 3, { action: "ANSWER" }), { statusCode: 400 });
    await assert.rejects(CareerService.respond(ALUMNUS, 3, { action: "ANSWER", response: "ok" }), { statusCode: 400 });
    assert.equal(w.transition.mock.callCount(), 0);
});

test("accepting requires the two to still be connected; declining is always possible", async () => {
    let w = forRespond(requestRow(), { connection: { status: "REMOVED" } });
    await assert.rejects(CareerService.respond(ALUMNUS, 3, { action: "ACCEPT" }), { statusCode: 409 });
    assert.equal(w.transition.mock.callCount(), 0);

    assert.equal((await CareerService.respond(ALUMNUS, 3, { action: "REJECT" })).status, "REJECTED");

    // a question never needed a connection (the alumnus opted in), so answering doesn't either
    mock.restoreAll();
    stubs = stubNotifications(mock);
    w = forRespond(requestRow({ type: "QUESTION", job_id: null }), { connection: undefined });
    assert.equal((await CareerService.respond(ALUMNUS, 3, { action: "ANSWER", response: "Here is a real answer." })).status, "ANSWERED");
    assert.equal(w.connection.mock.callCount(), 0);
});

test("a request from an account that is no longer ACTIVE can't be accepted", async () => {
    const w = forRespond(requestRow({ requester_status: "BLOCKED" }));
    await assert.rejects(CareerService.respond(ALUMNUS, 3, { action: "ACCEPT" }), { statusCode: 409 });
    assert.equal(w.transition.mock.callCount(), 0);
});

test("a lost race (status changed underneath) is a 409 and sends no notification", async () => {
    forRespond(requestRow(), { changed: false });
    await assert.rejects(CareerService.respond(ALUMNUS, 3, { action: "ACCEPT" }), { statusCode: 409 });
    assert.equal(stubs.notifyCareerUpdate.mock.callCount(), 0);
    assert.equal(stubs.markCareerRequestHandled.mock.callCount(), 0);
});

// ======================= acting only as yourself =======================

test("only the alumnus the request was sent to can respond", async () => {
    const w = forRespond(requestRow());

    // the student who made it
    await assert.rejects(CareerService.respond(STUDENT, 3, { action: "ACCEPT" }), { statusCode: 403 });
    // someone who has nothing to do with it - indistinguishable from a missing request
    await assert.rejects(CareerService.respond(OUTSIDER, 3, { action: "ACCEPT" }), { statusCode: 404 });
    await assert.rejects(CareerService.respond({ userId: 77, role: "ALUMNI" }, 3, { action: "ACCEPT" }), { statusCode: 404 });

    assert.equal(w.transition.mock.callCount(), 0);
    assert.equal(stubs.notifyCareerUpdate.mock.callCount(), 0);
});

test("only the student who made the request can cancel it", async () => {
    const w = forRespond(requestRow());

    await assert.rejects(CareerService.cancel(ALUMNUS, 3), { statusCode: 403 });
    await assert.rejects(CareerService.cancel(OUTSIDER, 3), { statusCode: 404 });
    assert.equal(w.transition.mock.callCount(), 0);

    assert.deepEqual(await CareerService.cancel(STUDENT, 3), { id: 3, status: "CANCELLED" });
    assert.deepEqual(w.transition.mock.calls[0].arguments[0], { id: 3, from: "PENDING", to: "CANCELLED", actorId: 1 });
});

test("cancelling: a pending request just disappears for the alumnus; an accepted one notifies them", async () => {
    forRespond(requestRow({ status: "PENDING" }));
    await CareerService.cancel(STUDENT, 3);
    assert.deepEqual(stubs.removeCareerRequestNotification.mock.calls[0].arguments, [3]);
    assert.equal(stubs.notifyCareerUpdate.mock.callCount(), 0);

    mock.restoreAll();
    stubs = stubNotifications(mock);
    forRespond(requestRow({ status: "ACCEPTED" }));
    await CareerService.cancel(STUDENT, 3);
    assert.deepEqual(stubs.notifyCareerUpdate.mock.calls[0].arguments[0], {
        requestId: 3, recipientId: 10, actorId: 1, requestType: "REFERRAL", status: "CANCELLED", text: "Backend Engineer at Acme Labs",
    });
});

test("finished requests can't be cancelled; an answered/accepted question can't either", async () => {
    for (const [type, status] of [["REFERRAL", "REJECTED"], ["REFERRAL", "COMPLETED"], ["REFERRAL", "CANCELLED"], ["QUESTION", "ANSWERED"], ["QUESTION", "ACCEPTED"]]) {
        const w = forRespond(requestRow({ type, status }));
        await assert.rejects(CareerService.cancel(STUDENT, 3), { statusCode: 409 }, `${type} ${status}`);
        assert.equal(w.transition.mock.callCount(), 0);
        mock.restoreAll();
        stubs = stubNotifications(mock);
    }
});

test("missing and malformed request ids", async () => {
    mock.method(CareerRepository, "findRequestById", async () => undefined);
    await assert.rejects(CareerService.getRequest(STUDENT, 999), { statusCode: 404 });
    await assert.rejects(CareerService.respond(ALUMNUS, 999, { action: "ACCEPT" }), { statusCode: 404 });
    for (const bad of ["abc", "0", "-1", "1.5"]) {
        await assert.rejects(CareerService.getRequest(STUDENT, bad), { statusCode: 400 }, bad);
    }
});

// ======================= what participants see =======================

test("a request is visible only to its two participants, with public profile fields only", async () => {
    mock.method(CareerRepository, "findRequestById", async () => requestRow());
    mock.method(CareerRepository, "findEvents", async () => [
        { actor_id: 1, from_status: null, to_status: "PENDING", note: null, created_at: "t1" },
        { actor_id: 10, from_status: "PENDING", to_status: "ACCEPTED", note: null, created_at: "t2" },
        { actor_id: null, from_status: "ACCEPTED", to_status: "CANCELLED", note: "Job was removed", created_at: "t3" },
    ]);

    await assert.rejects(CareerService.getRequest(OUTSIDER, 3), { statusCode: 404 });

    const asStudent = await CareerService.getRequest(STUDENT, 3);
    assert.deepEqual(Object.keys(asStudent).sort(), [
        "actions", "alumni", "created_at", "direction", "history", "id", "job", "message", "requester",
        "responded_at", "response", "resume_url", "status", "type", "updated_at",
    ]);
    assert.deepEqual(Object.keys(asStudent.requester).sort(), ["batch_year", "branch", "company", "designation", "full_name", "profile_photo", "role", "user_id"]);
    assert.deepEqual(Object.keys(asStudent.alumni).sort(), ["company", "designation", "full_name", "is_verified_alumni", "profile_photo", "user_id"]);
    assert.deepEqual(asStudent.job, { id: 7, title: "Backend Engineer", company: "Acme Labs", location: "Noida", status: "OPEN" });
    assert.equal(asStudent.direction, "sent");
    assert.equal(asStudent.alumni.is_verified_alumni, true);
    // history says who acted relative to the request, never a raw user id
    assert.deepEqual(asStudent.history.map((h) => [h.status, h.by, h.note]), [
        ["PENDING", "requester", null], ["ACCEPTED", "alumni", null], ["CANCELLED", "system", "Job was removed"],
    ]);
    const json = JSON.stringify(asStudent);
    for (const secret of ["secret.test", "EN123", "9999999999", "actor_id"]) {
        assert.equal(json.includes(secret), false, `${secret} leaked`);
    }

    assert.equal((await CareerService.getRequest(ALUMNUS, 3)).direction, "received");
});

test("the actions offered match what each participant may do right now", () => {
    const { actionsFor } = CareerService;
    assert.deepEqual(actionsFor(requestRow({ status: "PENDING" }), 10), ["ACCEPT", "REJECT"]);
    assert.deepEqual(actionsFor(requestRow({ status: "ACCEPTED" }), 10), ["COMPLETE"]);
    assert.deepEqual(actionsFor(requestRow({ status: "COMPLETED" }), 10), []);
    assert.deepEqual(actionsFor(requestRow({ type: "QUESTION", status: "PENDING" }), 10), ["ANSWER", "REJECT"]);
    assert.deepEqual(actionsFor(requestRow({ status: "PENDING" }), 1), ["CANCEL"]);
    assert.deepEqual(actionsFor(requestRow({ status: "ACCEPTED" }), 1), ["CANCEL"]);
    assert.deepEqual(actionsFor(requestRow({ status: "REJECTED" }), 1), []);
    assert.deepEqual(actionsFor(requestRow({ type: "QUESTION", status: "ANSWERED" }), 1), []);
    assert.deepEqual(actionsFor(requestRow(), 55), []); // an outsider can do nothing
});

test("dashboards: sent/received are scoped to the viewer, with pagination and role capabilities", async () => {
    const find = mock.method(CareerRepository, "findRequests", async () => [requestRow()]);
    mock.method(CareerRepository, "countRequests", async () => 21);

    const sent = await CareerService.listRequests(STUDENT, listRequestsSchema.parse({ box: "sent", type: "REFERRAL", status: "PENDING", page: "2", limit: "10" }));

    assert.deepEqual(find.mock.calls[0].arguments, [1, { box: "sent", type: "REFERRAL", status: "PENDING" }, 10, 10]);
    assert.deepEqual(sent.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
    assert.deepEqual([sent.can_request, sent.can_respond], [true, false]);
    assert.equal(JSON.stringify(sent).includes("secret.test"), false);

    const received = await CareerService.listRequests(ALUMNUS, listRequestsSchema.parse({ box: "received" }));
    assert.equal(find.mock.calls[1].arguments[0], 10);
    assert.deepEqual([received.can_request, received.can_respond], [false, true]);
});

// ======================= the SQL that actually runs =======================

test("list filter: always bound to the viewer and hides requests whose other party is not ACTIVE", () => {
    const sent = CareerRepository.buildListFilter(1, { box: "sent", type: "REFERRAL", status: "PENDING" });
    assert.match(sent.whereSql, /cr\.requester_id = \? AND au\.status = 'ACTIVE'/);
    assert.deepEqual(sent.params, [1, "REFERRAL", "PENDING"]);

    const received = CareerRepository.buildListFilter(10, { box: "received" });
    assert.match(received.whereSql, /cr\.alumni_id = \? AND ru\.status = 'ACTIVE'/);
    assert.deepEqual(received.params, [10]);
});

function captureSql(result = [[{ total: 0 }], []]) {
    const calls = [];
    mock.method(pool, "execute", async (sql, params) => {
        calls.push({ sql: sql.replace(/\s+/g, " "), params });
        return result;
    });
    return calls;
}

test("request queries never select private user columns", async () => {
    const calls = captureSql();
    await CareerRepository.findRequests(1, { box: "sent" }, 10, 0);
    await CareerRepository.findRequestById(3);
    await CareerRepository.findEligibleAlumni(1, { type: "REFERRAL", intent: "REFERRALS", jobId: 7, jobPosterId: 10, jobCompany: "Acme" });

    for (const { sql } of calls) {
        const select = sql.slice(sql.indexOf("SELECT"), sql.lastIndexOf(" FROM "));
        for (const col of ["email", "enrollment", "mobile", "dob", "password"]) {
            assert.equal(select.includes(col), false, `${col} must not be selected`);
        }
    }
    assert.match(calls[0].sql, /LIMIT 10 OFFSET 0/);
});

test("eligible alumni come only from the viewer's own ACCEPTED connections to ACTIVE alumni", async () => {
    const calls = captureSql();
    await CareerRepository.findEligibleAlumni(1, { type: "REFERRAL", intent: "REFERRALS", jobId: 7, jobPosterId: 10, jobCompany: "Acme" });
    const { sql, params } = calls[0];
    assert.match(sql, /c\.status = 'ACCEPTED'/);
    assert.match(sql, /u\.status = 'ACTIVE'/);
    assert.match(sql, /u\.role = 'ALUMNI'/);
    assert.match(sql, /c\.sender_id = \? OR c\.receiver_id = \?/);
    assert.equal(params.filter((p) => p === 1).length, 4); // the viewer id, bound every time
});

function fakeConnection(onExecute) {
    const log = [];
    const connection = {
        beginTransaction: async () => log.push("begin"),
        commit: async () => log.push("commit"),
        rollback: async () => log.push("rollback"),
        release: () => log.push("release"),
        execute: async (sql, params) => {
            const flat = sql.replace(/\s+/g, " ").trim();
            log.push(flat);
            return onExecute(flat, params);
        },
    };
    mock.method(pool, "getConnection", async () => connection);
    return log;
}

test("status changes are compare-and-set, and write history in the same transaction", async () => {
    const seen = [];
    let log = fakeConnection((sql, params) => { seen.push({ sql, params }); return [{ affectedRows: 1 }]; });

    assert.equal(await CareerRepository.transition({ id: 3, from: "PENDING", to: "ACCEPTED", actorId: 10, response: "ok then", markResponded: true }), true);

    assert.equal(seen[0].sql, "UPDATE career_requests SET status = ?, response = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?");
    assert.deepEqual(seen[0].params, ["ACCEPTED", "ok then", 3, "PENDING"]);
    assert.match(seen[1].sql, /INSERT INTO career_request_events/);
    assert.deepEqual(seen[1].params, [3, 10, "PENDING", "ACCEPTED"]);
    assert.deepEqual([log[0], log.at(-2), log.at(-1)], ["begin", "commit", "release"]);

    // someone else got there first: nothing matches, so no history row is written
    mock.restoreAll();
    log = fakeConnection(() => [{ affectedRows: 0 }]);
    assert.equal(await CareerRepository.transition({ id: 3, from: "PENDING", to: "ACCEPTED", actorId: 10 }), false);
    assert.equal(log.some((l) => l.includes("career_request_events")), false);
});

test("creating a request and its first history entry is atomic", async () => {
    const log = fakeConnection((sql) => {
        if (sql.includes("career_request_events")) throw new Error("boom");
        return [{ insertId: 5 }];
    });
    await assert.rejects(CareerRepository.createRequest({ type: "QUESTION", requesterId: 1, alumniId: 10, message: "hello there" }), /boom/);
    assert.ok(log.includes("rollback"));
    assert.equal(log.includes("commit"), false);
});

// ======================= deleted jobs =======================

test("deleting a job closes its active referral requests and tells the students", async () => {
    const cancel = mock.method(CareerRepository, "cancelActiveForJob", async () => [
        { id: 3, requester_id: 1, alumni_id: 10, status: "PENDING" },
        { id: 4, requester_id: 2, alumni_id: 10, status: "ACCEPTED" },
    ]);

    const closed = await CareerService.closeRequestsForDeletedJob(7, { title: "Backend Engineer", company: "Acme Labs" });

    assert.equal(closed, 2);
    assert.deepEqual(cancel.mock.calls[0].arguments, [7]);
    assert.deepEqual(stubs.notifyCareerUpdate.mock.calls.map((c) => [c.arguments[0].recipientId, c.arguments[0].status, c.arguments[0].actorId]), [
        [1, "CANCELLED", null],
        [2, "CANCELLED", null],
    ]);
    assert.match(stubs.notifyCareerUpdate.mock.calls[0].arguments[0].text, /Backend Engineer at Acme Labs was removed/);
    assert.equal(stubs.removeCareerRequestNotification.mock.callCount(), 2);
});

// ======================= notifications =======================

test("career notifications: right recipient, type, link and one-per-status dedupe key", async () => {
    mock.restoreAll(); // real NotificationService
    const pushed = [];
    registry.setIo({ to: (room) => ({ emit: (event, payload) => pushed.push({ room, event, payload }) }) });
    const insert = mock.method(NotificationRepository, "insertIfNew", async () => 501);
    mock.method(NotificationRepository, "findVisibleById", async (id) => ({
        id, type: "CAREER_REQUEST", reference_id: 3, extra: "x", is_read: 0, created_at: "t", actor_id: 1, actor_name: "Aarav", actor_photo: null,
    }));
    mock.method(NotificationRepository, "countByRecipient", async () => 1);

    await NotificationService.notifyCareerRequest({ requestId: 3, requesterId: 1, alumniId: 10, requestType: "REFERRAL", text: "Backend Engineer at Acme" });
    await NotificationService.notifyCareerUpdate({ requestId: 3, recipientId: 1, actorId: 10, requestType: "REFERRAL", status: "ACCEPTED", text: "Backend Engineer at Acme" });
    await NotificationService.notifyCareerUpdate({ requestId: 3, recipientId: 1, actorId: null, requestType: "REFERRAL", status: "CANCELLED", text: "removed" });

    const calls = insert.mock.calls.map((c) => c.arguments[0]);
    assert.deepEqual(calls.map((c) => [c.recipientId, c.actorId, c.type, c.referenceId, c.extra, c.dedupeKey]), [
        [10, 1, "CAREER_REQUEST", 3, "REFERRAL|PENDING|Backend Engineer at Acme", "CAREER:3:PENDING"],
        [1, 10, "CAREER_UPDATE", 3, "REFERRAL|ACCEPTED|Backend Engineer at Acme", "CAREER:3:ACCEPTED"],
        [1, null, "CAREER_UPDATE", 3, "REFERRAL|CANCELLED|removed", "CAREER:3:CANCELLED"],
    ]);
    assert.deepEqual(pushed.map((p) => p.room), ["user:10", "user:1", "user:1"]);
    registry.setIo(null);
});

test("a repeated status notification is a duplicate and is not sent again", async () => {
    mock.restoreAll();
    const pushed = [];
    registry.setIo({ to: () => ({ emit: (...a) => pushed.push(a) }) });
    mock.method(NotificationRepository, "insertIfNew", async () => null); // dedupe hit
    const bump = mock.method(NotificationRepository, "bumpByDedupeKey", async () => 1);

    await NotificationService.notifyCareerUpdate({ requestId: 3, recipientId: 1, actorId: 10, requestType: "REFERRAL", status: "ACCEPTED", text: "x" });

    assert.equal(bump.mock.callCount(), 0);
    assert.equal(pushed.length, 0);
    registry.setIo(null);
});

test("a failing notification never breaks the request itself", async () => {
    mock.restoreAll();
    mock.method(console, "error", () => {});
    mock.method(NotificationRepository, "insertIfNew", async () => { throw new Error("db down"); });
    mock.method(NotificationRepository, "markReadByDedupeKey", async () => { throw new Error("db down"); });
    forRespond(requestRow());

    assert.deepEqual(await CareerService.respond(ALUMNUS, 3, { action: "ACCEPT" }), { id: 3, status: "ACCEPTED" });
});

test("settling and removing the 'new request' notification use its dedupe key", async () => {
    mock.restoreAll();
    registry.setIo({ to: () => ({ emit: () => {} }) });
    const read = mock.method(NotificationRepository, "markReadByDedupeKey", async () => 1);
    const del = mock.method(NotificationRepository, "deleteByDedupeKey", async () => [10]);
    mock.method(NotificationRepository, "countByRecipient", async () => 0);

    await NotificationService.markCareerRequestHandled(3);
    await NotificationService.removeCareerRequestNotification(3);

    assert.deepEqual(read.mock.calls[0].arguments, ["CAREER:3:PENDING"]);
    assert.deepEqual(del.mock.calls[0].arguments, ["CAREER:3:PENDING"]);
    registry.setIo(null);
});

// ======================= HTTP API =======================

let server, base;

before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/career", careerRoutes);
    app.use(globalErrorHandler);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/api/career`;
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

test("HTTP: every career endpoint requires a signed-in user", async () => {
    for (const [method, path] of [["GET", "/alumni?type=QUESTION"], ["GET", "/requests"], ["POST", "/requests"], ["GET", "/requests/1"], ["PATCH", "/requests/1/respond"], ["PATCH", "/requests/1/cancel"]]) {
        assert.equal((await fetch(`${base}${path}`, { method })).status, 401, `${method} ${path}`);
    }
});

test("HTTP: a blocked user can do nothing", async () => {
    session(1, "STUDENT", "BLOCKED");
    assert.equal((await send("GET", "/requests", STUDENT)).status, 401);
    assert.equal((await send("POST", "/requests", STUDENT, questionBody)).status, 401);
});

test("HTTP: a student creates a request as themselves (201); the requester can't be forged", async () => {
    session(1, "STUDENT");
    const w = happyWorld();

    const res = await send("POST", "/requests", STUDENT, referralBody);
    assert.equal(res.status, 201);
    assert.deepEqual((await res.json()).data, { id: 99 });
    assert.equal(w.create.mock.calls[0].arguments[0].requesterId, 1);

    // trying to act for another student is rejected outright
    assert.equal((await send("POST", "/requests", STUDENT, { ...referralBody, requester_id: 55 })).status, 400);
    assert.equal(w.create.mock.callCount(), 1);
});

test("HTTP: role comes from the session - an alumnus (or a student with an ALUMNI-claiming token) follows session rules", async () => {
    happyWorld();
    session(10, "ALUMNI");
    assert.equal((await send("POST", "/requests", ALUMNUS, referralBody)).status, 403);

    // really an alumnus, but the token claims STUDENT: still refused
    assert.equal((await send("POST", "/requests", { userId: 10, role: "STUDENT" }, referralBody)).status, 403);
});

test("HTTP: validation errors, duplicates and missing connection map to 400 / 409 / 403", async () => {
    session(1, "STUDENT");
    const w = happyWorld();

    const invalid = await send("POST", "/requests", STUDENT, { ...referralBody, message: "too short" });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).message, "Validation failed");

    w.create.mock.mockImplementation(async () => { throw Object.assign(new Error("Duplicate entry 'x'"), { code: "ER_DUP_ENTRY" }); });
    const dup = await send("POST", "/requests", STUDENT, referralBody);
    assert.equal(dup.status, 409);
    assert.equal(JSON.stringify(await dup.json()).includes("Duplicate entry"), false);

    w.connection.mock.mockImplementation(async () => undefined);
    assert.equal((await send("POST", "/requests", STUDENT, referralBody)).status, 403);
});

test("HTTP: respond and cancel enforce who is acting", async () => {
    forRespond(requestRow());

    session(55, "STUDENT"); // not part of the request
    assert.equal((await send("PATCH", "/requests/3/respond", OUTSIDER, { action: "ACCEPT" })).status, 404);
    assert.equal((await send("PATCH", "/requests/3/cancel", OUTSIDER)).status, 404);
    assert.equal((await send("GET", "/requests/3", OUTSIDER)).status, 404);

    session(1, "STUDENT"); // the requester can't accept their own request
    assert.equal((await send("PATCH", "/requests/3/respond", STUDENT, { action: "ACCEPT" })).status, 403);

    session(10, "ALUMNI"); // the alumnus can't cancel it, but can accept
    assert.equal((await send("PATCH", "/requests/3/cancel", ALUMNUS)).status, 403);
    const ok = await send("PATCH", "/requests/3/respond", ALUMNUS, { action: "ACCEPT", response: "Sure" });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).data, { id: 3, status: "ACCEPTED" });

    assert.equal((await send("PATCH", "/requests/3/respond", ALUMNUS, { action: "APPROVE" })).status, 400);
    assert.equal((await send("PATCH", "/requests/abc/respond", ALUMNUS, { action: "ACCEPT" })).status, 400);
});

test("HTTP: dashboards and the eligible-alumni list", async () => {
    session(1, "STUDENT");
    mock.method(CareerRepository, "findRequests", async () => [requestRow()]);
    mock.method(CareerRepository, "countRequests", async () => 1);
    mock.method(CareerRepository, "findEligibleAlumni", async () => []);

    const res = await send("GET", "/requests?box=sent&type=REFERRAL", STUDENT);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.requests[0].direction, "sent");
    assert.deepEqual(body.data.requests[0].actions, ["CANCEL"]);
    assert.equal(JSON.stringify(body).includes("secret.test"), false);

    assert.equal((await send("GET", "/requests?box=everyone", STUDENT)).status, 400);
    assert.equal((await send("GET", "/alumni?type=REFERRAL", STUDENT)).status, 400); // job_id required
    assert.equal((await send("GET", "/alumni?type=QUESTION", STUDENT)).status, 200);
});
