import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAREER_PAGE_SIZE,
  EMPTY_REQUEST_FORM,
  REQUEST_TYPES,
  actionMeta,
  alumniTags,
  careerFiltersToApiParams,
  careerFiltersToUrl,
  careerNotificationText,
  counterpart,
  defaultBox,
  historyLabel,
  jobLine,
  parseCareerExtra,
  requestFormToPayload,
  requestTitle,
  statusMeta,
  typeMeta,
  urlToCareerFilters,
  validateRequestForm,
  validateResponse,
} from "../src/utils/careerFormat.js";
import { createCareerClient } from "../src/services/careerClient.js";
import { describeNotification } from "../src/utils/notificationFormat.js";

const FIT = "I built two Node.js services in my final-year project and would love to join.";

const student = { user_id: 1, full_name: "Aarav Sharma", profile_photo: null, branch: "CA", batch_year: 2025, role: "STUDENT" };
const alumnus = { user_id: 10, full_name: "Arjun Verma", profile_photo: null, designation: "Engineer", company: "Acme", is_verified_alumni: true };
const request = (over = {}) => ({
  id: 3, type: "REFERRAL", status: "PENDING", direction: "sent", message: FIT, resume_url: null, response: null,
  requester: student, alumni: alumnus, job: { id: 7, title: "Backend Engineer", company: "Acme Labs", location: "Noida", status: "OPEN" },
  actions: ["CANCEL"], ...over,
});

// ======================= labels =======================

test("the three request types and what each needs", () => {
  assert.deepEqual(REQUEST_TYPES.map((t) => t.value), ["REFERRAL", "RESUME_REVIEW", "QUESTION"]);
  assert.deepEqual(REQUEST_TYPES.map((t) => [t.needsJob, t.resume]), [[true, "optional"], [false, "required"], [false, "none"]]);
  assert.equal(typeMeta("RESUME_REVIEW").label, "Resume review");
  assert.equal(typeMeta("NOPE").value, "REFERRAL"); // unknown falls back instead of crashing
});

test("status badges", () => {
  assert.deepEqual(statusMeta("PENDING"), { label: "Waiting for reply", tone: "pending" });
  assert.equal(statusMeta("REJECTED").label, "Declined");
  assert.equal(statusMeta("ANSWERED").tone, "positive");
  assert.equal(statusMeta("WHATEVER").tone, "muted");
});

test("request titles read naturally from each side", () => {
  assert.equal(requestTitle(request()), "Referral request to Arjun Verma");
  assert.equal(requestTitle(request({ direction: "received" })), "Aarav Sharma asked for a referral");
  assert.equal(requestTitle(request({ type: "RESUME_REVIEW", direction: "received" })), "Aarav Sharma asked for a resume review");
  assert.equal(requestTitle(request({ type: "QUESTION" })), "Question for Arjun Verma");
  assert.equal(requestTitle(request({ type: "QUESTION", direction: "received" })), "Aarav Sharma asked a question");
  assert.equal(counterpart(request()).user_id, 10);
  assert.equal(counterpart(request({ direction: "received" })).user_id, 1);
  assert.equal(jobLine({ title: "Backend Engineer", company: "Acme Labs" }), "Backend Engineer at Acme Labs");
  assert.equal(jobLine(null), "");
});

// ======================= status transitions in the UI =======================

test("buttons come from the actions the server allows, with the right labels", () => {
  assert.equal(actionMeta("ACCEPT", "REFERRAL").label, "Accept");
  assert.equal(actionMeta("REJECT", "REFERRAL").label, "Decline");
  assert.equal(actionMeta("COMPLETE", "REFERRAL").label, "Mark as referred");
  assert.equal(actionMeta("COMPLETE", "RESUME_REVIEW").label, "Send feedback");
  assert.equal(actionMeta("ANSWER", "QUESTION").response, "required");
  assert.equal(actionMeta("CANCEL", "REFERRAL").response, "none");
  assert.equal(actionMeta("SOMETHING_NEW", "REFERRAL").label, "SOMETHING_NEW"); // never crashes on a new action
});

test("an answer is required for questions; notes are optional elsewhere", () => {
  assert.match(validateResponse("ANSWER", "QUESTION", ""), /at least 10/);
  assert.match(validateResponse("ANSWER", "QUESTION", "  short "), /at least 10/);
  assert.equal(validateResponse("ANSWER", "QUESTION", "Start with the fundamentals."), "");
  assert.equal(validateResponse("ACCEPT", "REFERRAL", ""), "");
  assert.equal(validateResponse("REJECT", "REFERRAL", ""), "");
  assert.match(validateResponse("ACCEPT", "REFERRAL", "x".repeat(2001)), /under 2000/);
});

test("history entries are written from the viewer's point of view", () => {
  const sent = request({ direction: "sent" });
  assert.equal(historyLabel({ status: "PENDING", by: "requester" }, sent), "You sent the request");
  assert.equal(historyLabel({ status: "ACCEPTED", by: "alumni" }, sent), "Arjun Verma accepted");
  assert.equal(historyLabel({ status: "COMPLETED", by: "alumni" }, sent), "Arjun Verma marked it as referred");
  assert.equal(historyLabel({ status: "CANCELLED", by: "system", note: "Job was removed" }, sent), "Job was removed");

  const received = request({ direction: "received" });
  assert.equal(historyLabel({ status: "PENDING", by: "requester" }, received), "Aarav Sharma sent the request");
  assert.equal(historyLabel({ status: "REJECTED", by: "alumni" }, received), "You declined");
  assert.equal(historyLabel({ status: "CANCELLED", by: "requester" }, received), "Aarav Sharma cancelled the request");
  assert.equal(historyLabel({ status: "COMPLETED", by: "alumni" }, request({ type: "RESUME_REVIEW", direction: "received" })), "You sent feedback");
});

test("why an alumnus is a good person to ask", () => {
  assert.deepEqual(alumniTags({ is_job_poster: true, same_company: true, is_open_to: true }, "REFERRAL"), ["Posted this job", "Works at this company", "Open to referrals"]);
  assert.deepEqual(alumniTags({ is_open_to: true }, "QUESTION"), ["Open to mentorship"]);
  assert.deepEqual(alumniTags({ is_open_to: true }, "RESUME_REVIEW"), ["Open to resume reviews"]);
  assert.deepEqual(alumniTags({}, "REFERRAL"), []);
});

// ======================= new request form =======================

const referralForm = { ...EMPTY_REQUEST_FORM, type: "REFERRAL", alumni_id: "10", job_id: "7", message: FIT };

test("a complete referral form is valid and maps to the API body (never a requester id)", () => {
  assert.deepEqual(validateRequestForm(referralForm), {});
  const payload = requestFormToPayload({ ...referralForm, message: `  ${FIT} `, resume_url: " https://drive.example/cv " });
  assert.deepEqual(payload, { type: "REFERRAL", alumni_id: 10, job_id: 7, message: FIT, resume_url: "https://drive.example/cv" });
  assert.equal("requester_id" in payload, false);
});

test("payload only carries what each type takes", () => {
  assert.deepEqual(requestFormToPayload({ ...referralForm, type: "QUESTION", job_id: "7", resume_url: "https://drive.example/cv" }), {
    type: "QUESTION", alumni_id: 10, message: FIT,
  });
  assert.deepEqual(requestFormToPayload({ ...referralForm, type: "RESUME_REVIEW", job_id: "", resume_url: "https://drive.example/cv" }), {
    type: "RESUME_REVIEW", alumni_id: 10, message: FIT, resume_url: "https://drive.example/cv",
  });
  assert.equal("resume_url" in requestFormToPayload(referralForm), false); // optional and left empty
});

test("form validation: alumnus, job, note length and resume link", () => {
  const errors = validateRequestForm(EMPTY_REQUEST_FORM);
  assert.ok(errors.alumni_id);
  assert.ok(errors.job_id); // a referral needs a job
  assert.ok(errors.message);

  assert.match(validateRequestForm({ ...referralForm, message: "pls refer me" }).message, /at least 20/);
  assert.match(validateRequestForm({ ...referralForm, message: "x".repeat(601) }).message, /under 600/);
  assert.equal(validateRequestForm({ ...referralForm, type: "QUESTION", job_id: "", message: "How do I prepare?" }).message, undefined); // 15+ chars
  assert.equal(validateRequestForm({ ...referralForm, type: "QUESTION", job_id: "" }).job_id, undefined);

  const review = { ...referralForm, type: "RESUME_REVIEW", job_id: "" };
  assert.match(validateRequestForm(review).resume_url, /link to your resume/);
  assert.match(validateRequestForm({ ...review, resume_url: "http://drive.example/cv" }).resume_url, /https/);
  assert.match(validateRequestForm({ ...review, resume_url: "javascript:alert(1)" }).resume_url, /https/);
  assert.equal(validateRequestForm({ ...review, resume_url: "https://drive.example/cv" }).resume_url, undefined);
  assert.match(validateRequestForm({ ...referralForm, resume_url: "ftp://x" }).resume_url, /https/); // optional but must be safe
});

// ======================= dashboard =======================

test("students land on what they sent, alumni on what they received", () => {
  assert.equal(defaultBox({ canRequest: true, canRespond: false }), "sent");
  assert.equal(defaultBox({ canRequest: false, canRespond: true }), "received");
  assert.equal(defaultBox({}), "sent");
});

test("dashboard filters survive the URL; junk is ignored", () => {
  const filters = { box: "received", type: "QUESTION", status: "PENDING" };
  const back = urlToCareerFilters(new URLSearchParams(careerFiltersToUrl(filters, 2).toString()));
  assert.deepEqual(back, { filters, page: 2 });

  assert.deepEqual(urlToCareerFilters(new URLSearchParams("box=everyone&type=MENTORSHIP&status=DONE&page=-3")), {
    filters: { box: "", type: "", status: "" }, page: 1,
  });
  assert.equal(careerFiltersToUrl({ box: "", type: "", status: "" }, 1).toString(), "");
});

test("API params for the dashboard", () => {
  assert.deepEqual(careerFiltersToApiParams({ box: "", type: "", status: "" }), { box: "sent", page: 1, limit: CAREER_PAGE_SIZE });
  assert.deepEqual(careerFiltersToApiParams({ box: "received", type: "REFERRAL", status: "ACCEPTED" }, 3), {
    box: "received", page: 3, limit: CAREER_PAGE_SIZE, type: "REFERRAL", status: "ACCEPTED",
  });
});

// ======================= API client =======================

function fakeHttp(responses = {}) {
  const calls = [];
  const respond = (method) => async (url, body) => {
    calls.push({ method, url, body });
    return { data: { data: responses[`${method} ${url}`] } };
  };
  return { calls, get: respond("GET"), post: respond("POST"), patch: respond("PATCH") };
}

test("career client: endpoints, params and normalised responses", async () => {
  const http = fakeHttp({
    "GET /career/alumni": { alumni: [{ user_id: 10 }], job: { id: 7 }, can_request: true },
    "GET /career/requests": { requests: [{ id: 3 }], can_request: true, can_respond: false, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
    "GET /career/requests/3": { id: 3 },
    "POST /career/requests": { id: 9 },
    "PATCH /career/requests/3/respond": { id: 3, status: "ACCEPTED" },
    "PATCH /career/requests/3/cancel": { id: 3, status: "CANCELLED" },
  });
  const client = createCareerClient(http);

  assert.deepEqual(await client.getEligibleAlumni("REFERRAL", 7), { alumni: [{ user_id: 10 }], job: { id: 7 }, canRequest: true });
  assert.deepEqual(http.calls[0].body.params, { type: "REFERRAL", job_id: 7 });
  await client.getEligibleAlumni("QUESTION");
  assert.deepEqual(http.calls[1].body.params, { type: "QUESTION" });

  const list = await client.listRequests({ box: "sent", type: "REFERRAL", status: "" }, 1);
  assert.deepEqual(http.calls[2].body.params, { box: "sent", page: 1, limit: 10, type: "REFERRAL" });
  assert.deepEqual([list.canRequest, list.canRespond, list.pagination.total], [true, false, 1]);

  assert.deepEqual(await client.getRequest(3), { id: 3 });
  assert.deepEqual(await client.createRequest({ type: "QUESTION" }), { id: 9 });

  assert.deepEqual(await client.respondToRequest(3, "ACCEPT", "  Sure thing  "), { id: 3, status: "ACCEPTED" });
  assert.deepEqual(http.calls.at(-1).body, { action: "ACCEPT", response: "Sure thing" });
  await client.respondToRequest(3, "REJECT", "   ");
  assert.deepEqual(http.calls.at(-1).body, { action: "REJECT" }); // empty note is not sent

  assert.deepEqual(await client.cancelRequest(3), { id: 3, status: "CANCELLED" });
  assert.deepEqual([http.calls.at(-1).method, http.calls.at(-1).url], ["PATCH", "/career/requests/3/cancel"]);
});

test("career client tolerates empty bodies", async () => {
  const client = createCareerClient(fakeHttp());
  assert.deepEqual(await client.getEligibleAlumni("QUESTION"), { alumni: [], job: null, canRequest: false });
  const list = await client.listRequests({ box: "", type: "", status: "" }, 2);
  assert.deepEqual(list, { requests: [], canRequest: false, canRespond: false, pagination: { page: 2, limit: 10, total: 0, totalPages: 1 } });
});

// ======================= notifications =======================

test("the notification payload is parsed safely", () => {
  assert.deepEqual(parseCareerExtra("REFERRAL|ACCEPTED|Backend Engineer at Acme"), { requestType: "REFERRAL", status: "ACCEPTED", text: "Backend Engineer at Acme" });
  assert.equal(parseCareerExtra("QUESTION|PENDING|Is C++ | Rust better?").text, "Is C++ | Rust better?"); // text may contain the separator
  assert.deepEqual(parseCareerExtra(null), { requestType: "", status: "", text: "" });
  assert.equal(parseCareerExtra("HACK|X|y").requestType, "");
});

test("request notifications tell the alumnus what was asked", () => {
  assert.deepEqual(careerNotificationText("CAREER_REQUEST", "REFERRAL|PENDING|Backend Engineer at Acme"), { message: "asked you for a referral", preview: "Backend Engineer at Acme" });
  assert.equal(careerNotificationText("CAREER_REQUEST", "RESUME_REVIEW|PENDING|x").message, "asked you for a resume review");
  assert.equal(careerNotificationText("CAREER_REQUEST", "QUESTION|PENDING|x").message, "asked you a question");
});

test("update notifications tell the right person what changed", () => {
  const msg = (extra, opts) => careerNotificationText("CAREER_UPDATE", extra, opts).message;
  assert.equal(msg("REFERRAL|ACCEPTED|x"), "accepted your referral request");
  assert.equal(msg("REFERRAL|REJECTED|x"), "declined your referral request");
  assert.equal(msg("REFERRAL|COMPLETED|x"), "referred you");
  assert.equal(msg("RESUME_REVIEW|COMPLETED|x"), "sent feedback on your resume");
  assert.equal(msg("QUESTION|ANSWERED|x"), "answered your question");
  assert.equal(msg("QUESTION|REJECTED|x"), "declined your question");
  assert.equal(msg("REFERRAL|CANCELLED|x"), "withdrew their referral request");
  assert.equal(msg("REFERRAL|CANCELLED|Job removed", { system: true }), "Your referral request was closed.");
  assert.equal(msg("garbage"), "updated a request");
});

test("career notifications open the request they are about", () => {
  const actor = { user_id: 1, full_name: "Aarav Sharma" };
  const asked = describeNotification({ type: "CAREER_REQUEST", reference_id: 3, extra: "REFERRAL|PENDING|Backend Engineer at Acme", actor });
  assert.equal(asked.actorName, "Aarav Sharma");
  assert.equal(asked.message, "asked you for a referral");
  assert.equal(asked.preview, "Backend Engineer at Acme");
  assert.equal(asked.to, "/career/requests/3");

  const answered = describeNotification({ type: "CAREER_UPDATE", reference_id: 8, extra: "QUESTION|ANSWERED|How do I prepare?", actor: { user_id: 10, full_name: "Arjun Verma" } });
  assert.equal(answered.message, "answered your question");
  assert.equal(answered.to, "/career/requests/8");

  // closed by the system (job removed): no person behind it
  const closed = describeNotification({ type: "CAREER_UPDATE", reference_id: 9, extra: "REFERRAL|CANCELLED|Backend Engineer at Acme was removed", actor: null });
  assert.equal(closed.actorName, "SRMS Connect");
  assert.equal(closed.message, "Your referral request was closed.");
  assert.equal(describeNotification({ type: "CAREER_UPDATE", reference_id: null, extra: "", actor }).to, "/career");
});
