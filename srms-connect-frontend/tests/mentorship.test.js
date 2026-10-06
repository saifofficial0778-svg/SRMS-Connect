import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_MENTOR_FORM,
  MENTORS_PAGE_SIZE,
  TOPICS,
  canRequestMentor,
  goalProgress,
  introAction,
  introNotificationText,
  introPathState,
  introStatus,
  introTitle,
  introToPayload,
  matchParams,
  matchSummary,
  mentorFiltersToApiParams,
  mentorFiltersToUrl,
  mentorProfileToPayload,
  mentorToForm,
  mentorshipAction,
  mentorshipHistoryLabel,
  mentorshipNotificationText,
  mentorshipRequestToPayload,
  mentorshipStatus,
  mentorshipTitle,
  otherPerson,
  parseGoals,
  parseList,
  sessionToPayload,
  spotsLabel,
  toggleTopic,
  topicLabel,
  urlToMentorFilters,
  validateGoal,
  validateIntro,
  validateMentorProfile,
  validateMentorshipRequest,
  validateSession,
} from "../src/utils/mentorshipFormat.js";
import { createMentorshipClient } from "../src/services/mentorshipClient.js";
import { describeNotification } from "../src/utils/notificationFormat.js";

const WHY = "I am preparing for backend interviews and would value your guidance.";

const mentorPerson = { user_id: 10, full_name: "Arjun Verma", is_verified_alumni: true };
const menteePerson = { user_id: 1, full_name: "Aarav Sharma" };
const mentorship = (over = {}) => ({
  id: 5, topic: "INTERVIEW_PREP", status: "PENDING", my_role: "mentee", message: WHY,
  mentor: mentorPerson, mentee: menteePerson, actions: ["CANCEL"], ...over,
});
const intro = (over = {}) => ({
  id: 9, status: "PENDING", my_role: "requester", message: WHY,
  requester: menteePerson, target: { user_id: 20, full_name: "Neha Gupta" }, introducer: mentorPerson, actions: ["CANCEL"], ...over,
});

// records every call; replies with whatever the test queued
function fakeHttp(reply = {}) {
  const calls = [];
  const respond = (method) => async (url, a, b) => {
    calls.push({ method, url, body: method === "get" ? undefined : a, params: (method === "get" ? a : b)?.params });
    return { data: { data: typeof reply === "function" ? reply(method, url) : reply } };
  };
  return { calls, get: respond("get"), post: respond("post"), put: respond("put"), patch: respond("patch") };
}

// ======================= labels =======================

test("topics and statuses have readable labels; unknown values fall back safely", () => {
  assert.equal(TOPICS.length, 10);
  assert.equal(topicLabel("INTERVIEW_PREP"), "Interview preparation");
  assert.equal(topicLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(topicLabel(undefined), "");
  assert.deepEqual(mentorshipStatus("ACTIVE"), { label: "Active", tone: "positive" });
  assert.deepEqual(mentorshipStatus("WEIRD"), { label: "WEIRD", tone: "muted" });
  assert.deepEqual(introStatus("INTRODUCED"), { label: "Introduced", tone: "positive" });
  assert.equal(introStatus("DECLINED").tone, "negative");
});

test("parseList trims, drops blanks and de-duplicates case-insensitively", () => {
  assert.deepEqual(parseList(" React, node.js,, react ,  "), ["React", "node.js"]);
  assert.deepEqual(parseList(""), []);
  assert.deepEqual(parseList(null), []);
});

// ======================= mentor profile =======================

const validProfile = () => ({
  ...EMPTY_MENTOR_FORM,
  bio: "Backend engineer for six years, happy to help with interviews.",
  availability: "Weekends, evenings IST",
  topics: ["INTERVIEW_PREP", "CAREER_GUIDANCE"],
  areas: "CSE, backend , CSE",
});

test("mentor profile: a complete form is valid", () => {
  assert.deepEqual(validateMentorProfile(validProfile()), {});
});

test("mentor profile: every rule is reported on its own field", () => {
  const errors = validateMentorProfile({ ...EMPTY_MENTOR_FORM, bio: "short", availability: "", max_active_mentees: "0", topics: [], areas: "a" });
  assert.deepEqual(Object.keys(errors).sort(), ["areas", "availability", "bio", "max_active_mentees", "topics"]);
  assert.match(validateMentorProfile({ ...validProfile(), max_active_mentees: "21" }).max_active_mentees, /1 and 20/);
  assert.match(validateMentorProfile({ ...validProfile(), max_active_mentees: "2.5" }).max_active_mentees, /1 and 20/);
  assert.match(validateMentorProfile({ ...validProfile(), topics: TOPICS.slice(0, 7).map((t) => t.value) }).topics, /at most 6/);
  assert.match(validateMentorProfile({ ...validProfile(), areas: "a1,b2,c3,d4,e5,f6" }).areas, /at most 5/);
  // unknown topic codes do not count as a choice
  assert.ok(validateMentorProfile({ ...validProfile(), topics: ["HACKING"] }).topics);
});

test("mentor profile payload is clean and never carries a user id", () => {
  const payload = mentorProfileToPayload({ ...validProfile(), topics: ["INTERVIEW_PREP", "HACKING"], max_active_mentees: "4", user_id: 99, mentor_id: 99 });
  assert.deepEqual(payload, {
    bio: "Backend engineer for six years, happy to help with interviews.",
    availability: "Weekends, evenings IST",
    max_active_mentees: 4,
    is_accepting: true,
    topics: ["INTERVIEW_PREP"],
    areas: ["CSE", "backend"],
  });
});

test("mentorToForm round-trips a saved profile and gives defaults for none", () => {
  assert.deepEqual(mentorToForm(null), { ...EMPTY_MENTOR_FORM });
  const form = mentorToForm({ bio: "b", availability: "a", max_active_mentees: 5, is_accepting: 0, topics: ["SOFT_SKILLS"], areas: ["CSE", "IT"] });
  assert.deepEqual(form, { bio: "b", availability: "a", max_active_mentees: "5", is_accepting: false, topics: ["SOFT_SKILLS"], areas: "CSE, IT" });
});

test("toggleTopic adds and removes without mutating", () => {
  const start = ["A"];
  assert.deepEqual(toggleTopic(start, "B"), ["A", "B"]);
  assert.deepEqual(toggleTopic(start, "A"), []);
  assert.deepEqual(start, ["A"]);
});

// ======================= cards and matching =======================

test("spots: wording and whether a request is possible", () => {
  assert.equal(spotsLabel({ is_accepting: true, spots_left: 2, max_active_mentees: 3 }), "2 of 3 spots free");
  assert.equal(spotsLabel({ is_accepting: true, spots_left: 1, max_active_mentees: 1 }), "1 of 1 spot free");
  assert.equal(spotsLabel({ is_accepting: true, spots_left: 0, max_active_mentees: 3 }), "No free spots right now");
  assert.equal(spotsLabel({ is_accepting: false, spots_left: 3, max_active_mentees: 3 }), "Not accepting mentees right now");
  assert.equal(canRequestMentor({ is_accepting: true, spots_left: 1 }), true);
  assert.equal(canRequestMentor({ is_accepting: true, spots_left: 0 }), false);
  assert.equal(canRequestMentor({ is_accepting: false, spots_left: 2 }), false);
});

test("a match score is always shown with what it is out of", () => {
  assert.equal(matchSummary({ score: 58, max_score: 114, percent: 51 }), "58 of 114 points (51%)");
  assert.equal(matchSummary(null), "");
});

test("mentor filters: URL <-> filters <-> API params", () => {
  const { filters, page } = urlToMentorFilters(new URLSearchParams("q=%20arjun%20&topic=INTERVIEW_PREP&skills=React,%20Node&page=3"));
  assert.deepEqual(filters, { q: "arjun", topic: "INTERVIEW_PREP", skills: "React, Node" });
  assert.equal(page, 3);
  // junk in the URL is ignored
  assert.deepEqual(urlToMentorFilters(new URLSearchParams("topic=DROP_TABLE&page=-2")), { filters: { q: "", topic: "", skills: "" }, page: 1 });

  assert.equal(mentorFiltersToUrl(filters, 3).toString(), "q=arjun&topic=INTERVIEW_PREP&skills=React%2C+Node&page=3");
  assert.equal(mentorFiltersToUrl({ q: "", topic: "", skills: "" }).toString(), "");

  assert.deepEqual(mentorFiltersToApiParams(filters, 2), { page: 2, limit: MENTORS_PAGE_SIZE, q: "arjun", topic: "INTERVIEW_PREP", skills: "React,Node" });
  // a one-letter search is not sent
  assert.deepEqual(mentorFiltersToApiParams({ q: "a", topic: "", skills: "" }), { page: 1, limit: MENTORS_PAGE_SIZE });
});

test("matching is asked about a topic and skills only, never about a user", () => {
  assert.deepEqual(matchParams({ q: "arjun", topic: "SKILL_ROADMAP", skills: "React, react, SQL", user_id: 4, mentee_id: 4 }), { topic: "SKILL_ROADMAP", skills: "React,SQL" });
  assert.deepEqual(matchParams({ q: "", topic: "", skills: "" }), {});
});

// ======================= mentorship requests =======================

test("request form: topic must be one the mentor offers; message and goals are checked", () => {
  const mentor = { topics: ["INTERVIEW_PREP"] };
  assert.deepEqual(validateMentorshipRequest({ topic: "INTERVIEW_PREP", message: WHY, goals: "Two mock interviews\nRevise DSA" }, mentor), {});
  assert.match(validateMentorshipRequest({ topic: "", message: WHY, goals: "" }, mentor).topic, /Choose/);
  assert.match(validateMentorshipRequest({ topic: "HIGHER_STUDIES", message: WHY, goals: "" }, mentor).topic, /doesn't offer/);
  assert.match(validateMentorshipRequest({ topic: "INTERVIEW_PREP", message: "", goals: "" }, mentor).message, /Tell the mentor/);
  assert.match(validateMentorshipRequest({ topic: "INTERVIEW_PREP", message: "too short", goals: "" }, mentor).message, /at least 20/);
  assert.match(validateMentorshipRequest({ topic: "INTERVIEW_PREP", message: "x".repeat(1001), goals: "" }, mentor).message, /under 1000/);
  assert.match(validateMentorshipRequest({ topic: "INTERVIEW_PREP", message: WHY, goals: "one goal\ntwo goal\nthree goal\nfour goal" }, mentor).goals, /at most 3/);
  assert.match(validateMentorshipRequest({ topic: "INTERVIEW_PREP", message: WHY, goals: "ab" }, mentor).goals, /3 to 200/);
});

test("request payload: one goal per line, and the mentee is never sent", () => {
  assert.deepEqual(parseGoals(" first \n\n second\n"), ["first", "second"]);
  const payload = mentorshipRequestToPayload({ topic: "INTERVIEW_PREP", message: `  ${WHY} `, goals: "Mock interviews\n", mentee_id: 77, status: "ACTIVE" }, "10");
  assert.deepEqual(payload, { mentor_id: 10, topic: "INTERVIEW_PREP", message: WHY, goals: ["Mock interviews"] });
});

test("titles and the other person depend on the viewer's side", () => {
  assert.equal(otherPerson(mentorship()).full_name, "Arjun Verma");
  assert.equal(otherPerson(mentorship({ my_role: "mentor" })).full_name, "Aarav Sharma");
  assert.equal(mentorshipTitle(mentorship()), "Mentorship request to Arjun Verma");
  assert.equal(mentorshipTitle(mentorship({ status: "ACTIVE" })), "Mentorship with Arjun Verma");
  assert.equal(mentorshipTitle(mentorship({ my_role: "mentor" })), "Aarav Sharma asked you to mentor them");
  assert.equal(mentorshipTitle(mentorship({ my_role: "mentor", status: "COMPLETED" })), "Mentoring Aarav Sharma");
});

test("action buttons: known actions have labels; unknown ones stay harmless", () => {
  assert.equal(mentorshipAction("ACCEPT").label, "Accept");
  assert.equal(mentorshipAction("REJECT").tone, "danger");
  assert.equal(mentorshipAction("CANCEL").note, "none");
  assert.deepEqual(mentorshipAction("NUKE"), { label: "NUKE", tone: "secondary", note: "none" });
  assert.equal(introAction("INTRODUCE").label, "Make the introduction");
  assert.equal(introAction("DECLINE").tone, "danger");
});

test("history names sides, not ids", () => {
  const m = mentorship({ my_role: "mentee" });
  assert.equal(mentorshipHistoryLabel({ status: "PENDING", by: "mentee" }, m), "You sent the request");
  assert.equal(mentorshipHistoryLabel({ status: "ACTIVE", by: "mentor" }, m), "Arjun Verma accepted - the mentorship started");
  assert.equal(mentorshipHistoryLabel({ status: "CANCELLED", by: "system" }, m), "Updated automatically");
  assert.equal(mentorshipHistoryLabel({ status: "COMPLETED", by: "mentor" }, mentorship({ my_role: "mentor" })), "You completed the mentorship");
});

test("goals: progress and validation", () => {
  assert.deepEqual(goalProgress([{ status: "DONE" }, { status: "OPEN" }, { status: "DONE" }]), { done: 2, total: 3, label: "2 of 3 done" });
  assert.equal(goalProgress([]).label, "No goals yet");
  assert.equal(goalProgress(undefined).total, 0);
  assert.equal(validateGoal("Finish two mock interviews"), "");
  assert.match(validateGoal(" a "), /at least 3/);
  assert.match(validateGoal("x".repeat(201)), /at most 200/);
});

test("sessions: only past or today's dates, optional duration, required notes", () => {
  const today = "2026-10-06";
  assert.deepEqual(validateSession({ session_date: "2026-10-06", duration_minutes: "", notes: "Reviewed the resume." }, today), {});
  assert.deepEqual(validateSession({ session_date: "2026-10-01", duration_minutes: "45", notes: "Mock interview." }, today), {});
  assert.match(validateSession({ session_date: "2026-10-07", duration_minutes: "", notes: "Planned call." }, today).session_date, /after it has happened/);
  assert.match(validateSession({ session_date: "", duration_minutes: "", notes: "Notes here" }, today).session_date, /Choose the date/);
  assert.ok(validateSession({ session_date: "2026-10-01", duration_minutes: "4", notes: "Notes here" }, today).duration_minutes);
  assert.ok(validateSession({ session_date: "2026-10-01", duration_minutes: "601", notes: "Notes here" }, today).duration_minutes);
  assert.ok(validateSession({ session_date: "2026-10-01", duration_minutes: "abc", notes: "Notes here" }, today).duration_minutes);
  assert.ok(validateSession({ session_date: "2026-10-01", duration_minutes: "", notes: "hi" }, today).notes);

  assert.deepEqual(sessionToPayload({ session_date: "2026-10-01", duration_minutes: " 45 ", notes: " Mock interview. " }), { session_date: "2026-10-01", notes: "Mock interview.", duration_minutes: 45 });
  assert.deepEqual(sessionToPayload({ session_date: "2026-10-01", duration_minutes: "", notes: "Notes" }), { session_date: "2026-10-01", notes: "Notes" });
});

// ======================= warm introductions =======================

test("intro form: an introducer and a real message are required; the requester is never sent", () => {
  assert.deepEqual(validateIntro({ introducer_id: "10", message: WHY }), {});
  assert.deepEqual(Object.keys(validateIntro({ introducer_id: "", message: "" })).sort(), ["introducer_id", "message"]);
  assert.match(validateIntro({ introducer_id: "10", message: "hello" }).message, /at least 20/);
  assert.match(validateIntro({ introducer_id: "10", message: "x".repeat(601) }).message, /under 600/);
  assert.deepEqual(introToPayload({ introducer_id: "10", message: ` ${WHY} `, requester_id: 5 }, "20"), { target_id: 20, introducer_id: 10, message: WHY });
});

test("intro page state follows what the server reports", () => {
  const base = { already_connected: false, can_request: true, existing: null, introducers: [mentorPerson] };
  assert.equal(introPathState(null), "loading");
  assert.equal(introPathState(base), "ready");
  assert.equal(introPathState({ ...base, already_connected: true }), "connected");
  assert.equal(introPathState({ ...base, existing: { id: 3, status: "PENDING" } }), "pending");
  assert.equal(introPathState({ ...base, existing: { id: 3, status: "INTRODUCED" } }), "introduced");
  assert.equal(introPathState({ ...base, can_request: false }), "not-allowed");
  assert.equal(introPathState({ ...base, introducers: [] }), "no-path");
  // already connected wins over everything else: no introduction is offered
  assert.equal(introPathState({ ...base, already_connected: true, existing: { id: 3, status: "PENDING" } }), "connected");
});

test("intro titles read correctly from each of the three sides", () => {
  assert.equal(introTitle(intro()), "Introduction to Neha Gupta through Arjun Verma");
  assert.equal(introTitle(intro({ my_role: "introducer" })), "Aarav Sharma asked you to introduce them to Neha Gupta");
  assert.equal(introTitle(intro({ my_role: "target", status: "INTRODUCED" })), "Arjun Verma introduced Aarav Sharma to you");
});

// ======================= notifications =======================

test("mentorship notifications: wording per event, link to the request", () => {
  assert.deepEqual(mentorshipNotificationText("MENTORSHIP_REQUEST", "PENDING|INTERVIEW_PREP|Please help"), { message: "asked you to mentor them on interview preparation", preview: "Please help" });
  assert.equal(mentorshipNotificationText("MENTORSHIP_UPDATE", "ACTIVE|INTERVIEW_PREP|").message, "accepted your mentorship request");
  assert.equal(mentorshipNotificationText("MENTORSHIP_UPDATE", "REJECTED|X|").message, "declined your mentorship request");
  assert.equal(mentorshipNotificationText("MENTORSHIP_UPDATE", "GOAL_ADDED|X|Mock interviews").preview, "Mock interviews");
  assert.equal(mentorshipNotificationText("MENTORSHIP_UPDATE", "SESSION|X|").message, "logged a mentorship session");
  // text may itself contain the separator
  assert.equal(mentorshipNotificationText("MENTORSHIP_UPDATE", "GOAL_DONE|X|a|b").preview, "a|b");
  assert.equal(mentorshipNotificationText("MENTORSHIP_UPDATE", "").message, "updated your mentorship");

  const described = describeNotification({ type: "MENTORSHIP_REQUEST", actor: { user_id: 1, full_name: "Aarav Sharma" }, extra: "PENDING|CAREER_GUIDANCE|Hello", reference_id: 5 });
  assert.equal(described.actorName, "Aarav Sharma");
  assert.equal(described.message, "asked you to mentor them on career guidance");
  assert.equal(described.to, "/mentorship/requests/5");
  assert.equal(describeNotification({ type: "MENTORSHIP_UPDATE", extra: "ACTIVE|X|" }).to, "/mentorship/dashboard");
});

test("intro notifications: wording per event, link to the introduction", () => {
  assert.equal(introNotificationText("INTRO_REQUEST", "PENDING|Neha Gupta").message, "asked you to introduce them to Neha Gupta");
  assert.equal(introNotificationText("INTRO_UPDATE", "INTRODUCED|Neha Gupta").message, "introduced you to Neha Gupta");
  assert.equal(introNotificationText("INTRO_UPDATE", "DECLINED|Neha Gupta").message, "couldn't introduce you to Neha Gupta");
  assert.equal(introNotificationText("INTRO_UPDATE", "INTRODUCED_TO_YOU|Aarav Sharma").message, "would like to introduce Aarav Sharma to you");
  assert.equal(introNotificationText("INTRO_UPDATE", "").message, "updated an introduction");

  const described = describeNotification({ type: "INTRO_UPDATE", actor: { user_id: 10, full_name: "Arjun Verma" }, extra: "INTRODUCED_TO_YOU|Aarav Sharma", reference_id: 9 });
  assert.equal(described.to, "/mentorship/intros/9");
  assert.equal(described.message, "would like to introduce Aarav Sharma to you");
  assert.equal(describeNotification({ type: "INTRO_REQUEST", extra: "PENDING|X" }).to, "/mentorship/intros");
});

// ======================= API client =======================

test("client: discovery calls the right endpoints with clean params", async () => {
  const http = fakeHttp({ mentors: [{ user_id: 10 }], can_request: true, can_be_mentor: false, pagination: { page: 2, limit: 12, total: 13, totalPages: 2 } });
  const client = createMentorshipClient(http);

  const list = await client.listMentors({ q: "ar", topic: "INTERVIEW_PREP", skills: "React, Node" }, 2);
  assert.deepEqual(http.calls[0], { method: "get", url: "/mentorship/mentors", body: undefined, params: { page: 2, limit: 12, q: "ar", topic: "INTERVIEW_PREP", skills: "React,Node" } });
  assert.equal(list.canRequest, true);
  assert.equal(list.canBeMentor, false);
  assert.equal(list.pagination.totalPages, 2);

  await client.getMatches({ q: "ignored", topic: "INTERVIEW_PREP", skills: "" });
  assert.deepEqual(http.calls[1].params, { topic: "INTERVIEW_PREP" });
  assert.equal(http.calls[1].url, "/mentorship/matches");

  await client.getMentor(10);
  assert.equal(http.calls[2].url, "/mentorship/mentors/10");
});

test("client: empty or missing responses become safe defaults", async () => {
  const client = createMentorshipClient(fakeHttp(undefined));
  assert.deepEqual(await client.listMentors({ q: "", topic: "", skills: "" }), { mentors: [], canRequest: false, canBeMentor: false, pagination: { page: 1, limit: 12, total: 0, totalPages: 1 } });
  assert.deepEqual(await client.getMatches({ topic: "", skills: "" }), { matches: [], criteria: null, mentorsConsidered: 0, canRequest: false });
  assert.deepEqual(await client.getMyMentorProfile(), { canBeMentor: false, mentor: null });
  assert.deepEqual(await client.getIntroPaths(20), { target: null, already_connected: false, can_request: false, existing: null, introducers: [] });
  assert.deepEqual((await client.listIntros()).intros, []);
  assert.deepEqual((await client.listMentorships()).mentorships, []);
});

test("client: mentorship actions hit the request's own endpoints and never name the actor", async () => {
  const http = fakeHttp({ id: 5 });
  const client = createMentorshipClient(http);

  await client.saveMentorProfile({ bio: "b" });
  await client.createMentorship({ mentor_id: 10, topic: "INTERVIEW_PREP", message: WHY, goals: [] });
  await client.listMentorships({ box: "mentor", status: "PENDING" }, 2);
  await client.getMentorship(5);
  await client.respondToMentorship(5, "ACCEPT", "  Welcome!  ");
  await client.respondToMentorship(5, "REJECT", "   ");
  await client.cancelMentorship(5);
  await client.completeMentorship(5, "");
  await client.completeMentorship(5, "Well done");
  await client.addGoal(5, "  Mock interviews ");
  await client.setGoalStatus(5, 3, "DONE");
  await client.addSession(5, { session_date: "2026-10-01", notes: "Notes" });

  assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), [
    "put /mentorship/mentor-profile",
    "post /mentorship/requests",
    "get /mentorship/requests",
    "get /mentorship/requests/5",
    "patch /mentorship/requests/5/respond",
    "patch /mentorship/requests/5/respond",
    "patch /mentorship/requests/5/cancel",
    "patch /mentorship/requests/5/complete",
    "patch /mentorship/requests/5/complete",
    "post /mentorship/requests/5/goals",
    "patch /mentorship/requests/5/goals/3",
    "post /mentorship/requests/5/sessions",
  ]);
  assert.deepEqual(http.calls[2].params, { box: "mentor", page: 2, limit: 10, status: "PENDING" });
  assert.deepEqual(http.calls[4].body, { action: "ACCEPT", response: "Welcome!" });
  assert.deepEqual(http.calls[5].body, { action: "REJECT" }); // a blank note is not sent
  assert.equal(http.calls[6].body, undefined);
  assert.deepEqual(http.calls[7].body, {});
  assert.deepEqual(http.calls[8].body, { note: "Well done" });
  assert.deepEqual(http.calls[9].body, { title: "Mock interviews" });
  assert.deepEqual(http.calls[10].body, { status: "DONE" });

  for (const call of http.calls) {
    const sent = JSON.stringify({ ...call.body, ...call.params });
    assert.doesNotMatch(sent, /mentee_id|requester_id|user_id|actor/);
  }
});

test("client: introductions", async () => {
  const http = fakeHttp({ intros: [{ id: 9 }], can_request: false, can_introduce: true });
  const client = createMentorshipClient(http);

  await client.getIntroPaths("20");
  const list = await client.listIntros("to_introduce", 2);
  await client.createIntro({ target_id: 20, introducer_id: 10, message: WHY });
  await client.getIntro(9);
  await client.respondToIntro(9, "INTRODUCE", " Great student ");
  await client.respondToIntro(9, "DECLINE");
  await client.cancelIntro(9);

  assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), [
    "get /intros/paths",
    "get /intros",
    "post /intros",
    "get /intros/9",
    "patch /intros/9/respond",
    "patch /intros/9/respond",
    "patch /intros/9/cancel",
  ]);
  assert.deepEqual(http.calls[0].params, { target_id: "20" });
  assert.deepEqual(http.calls[1].params, { box: "to_introduce", page: 2, limit: 10 });
  assert.equal(list.canIntroduce, true);
  assert.equal(list.canRequest, false);
  assert.deepEqual(http.calls[4].body, { action: "INTRODUCE", note: "Great student" });
  assert.deepEqual(http.calls[5].body, { action: "DECLINE" });
});
