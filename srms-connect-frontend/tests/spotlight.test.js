import { test } from "node:test";
import assert from "node:assert/strict";

import { MESSAGES_NAV, MOBILE_MORE_KEYS, MOBILE_NAV_KEYS, NETWORK_TABS, PRIMARY_NAV, activeNavKey, isNavActive, navItem } from "../src/utils/navigation.js";
import {
  EMPTY_SPOTLIGHT_FORM,
  SPOTLIGHT_CATEGORIES,
  categoryLabel,
  dateBadge,
  parseLocalDateTime,
  profileCompletion,
  spotlightActions,
  spotlightState,
  spotlightToForm,
  spotlightToPayload,
  suggestionReason,
  validateSpotlightForm,
  whenLabel,
  whereLabel,
} from "../src/utils/spotlightFormat.js";
import { createSpotlightClient } from "../src/services/spotlightClient.js";
import { BADGE_TONES, BUTTON_SIZES, BUTTON_VARIANTS, buttonClass, segmentClass } from "../src/components/ui/styles.js";

function fakeHttp(reply) {
  const calls = [];
  const respond = (method) => async (url, a, b) => {
    calls.push({ method, url, body: method === "get" || method === "delete" ? undefined : a, params: (method === "get" ? a : b)?.params });
    return { data: { data: reply } };
  };
  return { calls, get: respond("get"), post: respond("post"), patch: respond("patch"), delete: respond("delete") };
}

// ======================= navigation =======================

test("the product has six primary areas, with Messages as a utility", () => {
  assert.deepEqual(PRIMARY_NAV.map((n) => n.label), ["Home", "Network", "Jobs", "Mentorship", "Career", "Insights"]);
  assert.equal(MESSAGES_NAV.to, "/chat");
  assert.deepEqual(NETWORK_TABS.map((t) => t.to), ["/alumni", "/network"]);
});

test("every page belongs to the right section", () => {
  const cases = {
    "/home": "home",
    "/alumni": "network",
    "/network": "network",
    "/profile/12": "network", // someone in your network
    "/jobs": "jobs",
    "/jobs/7/edit": "jobs",
    "/mentorship": "mentorship",
    "/mentorship/intros/new": "mentorship",
    "/career/requests/3": "career",
    "/industry-pulse": "insights",
    "/skill-gap": "insights",
    "/analytics": "insights",
    "/chat": "messages",
  };
  for (const [path, key] of Object.entries(cases)) assert.equal(activeNavKey(path), key, path);
});

test("your own profile and unknown pages highlight nothing; prefixes do not bleed", () => {
  assert.equal(activeNavKey("/profile"), null);
  assert.equal(activeNavKey("/something-else"), null);
  assert.equal(activeNavKey("/jobsboard"), null); // not /jobs
  assert.equal(activeNavKey("/homepage"), null);
  assert.equal(activeNavKey(undefined), null);
  assert.equal(isNavActive(navItem("jobs"), "/jobs/new"), true);
});

test("phones: four tabs in the bottom bar, the rest behind More - nothing is unreachable", () => {
  const reachable = [...MOBILE_NAV_KEYS, ...MOBILE_MORE_KEYS].sort();
  assert.deepEqual(reachable, [...PRIMARY_NAV.map((n) => n.key), "messages"].sort());
  assert.equal(MOBILE_NAV_KEYS.length, 4);
  for (const key of reachable) assert.ok(navItem(key), key);
});

// ======================= design-system recipes =======================

test("every button variant, size and badge tone resolves to classes", () => {
  for (const variant of Object.keys(BUTTON_VARIANTS)) for (const size of Object.keys(BUTTON_SIZES)) assert.match(buttonClass({ variant, size }), /inline-flex/);
  assert.match(buttonClass(), /bg-brand/); // primary by default
  assert.match(buttonClass({ variant: "nope" }), /bg-brand/); // unknown falls back, never empty
  assert.match(buttonClass({ block: true }), /w-full/);
  for (const tone of ["neutral", "muted", "pending", "positive", "negative", "brand", "accent"]) assert.ok(BADGE_TONES[tone], tone);
  assert.notEqual(segmentClass(true), segmentClass(false));
});

// ======================= spotlight dates =======================

test("dates are read exactly as written, never shifted by a time zone", () => {
  assert.deepEqual(parseLocalDateTime("2026-11-05T14:30"), { year: 2026, month: 11, day: 5, hour: 14, minute: 30, weekday: 4 });
  assert.equal(parseLocalDateTime(""), null);
  assert.equal(parseLocalDateTime("05/11/2026"), null);
  assert.deepEqual(dateBadge("2026-11-05T14:30"), { month: "NOV", day: "5" });
  assert.equal(dateBadge(null), null);
});

test("when: one moment, a time range on one day, or a span of days", () => {
  assert.equal(whenLabel("2026-11-05T14:30", null), "Thu, 5 Nov · 2:30 PM");
  assert.equal(whenLabel("2026-11-05T09:00", "2026-11-05T17:00"), "Thu, 5 Nov · 9 AM – 5 PM");
  assert.equal(whenLabel("2026-11-05T09:00", "2026-11-07T17:00"), "5 Nov – 7 Nov");
  assert.equal(whenLabel("2026-11-05T00:00", null), "Thu, 5 Nov · 12 AM");
  assert.equal(whenLabel("2026-11-05T12:05", null), "Thu, 5 Nov · 12:05 PM");
  assert.equal(whenLabel(null, null), "");
});

test("where: a place, online, or both", () => {
  assert.equal(whereLabel({ location: "Seminar Hall 2", is_online: false }), "Seminar Hall 2");
  assert.equal(whereLabel({ location: null, is_online: true }), "Online");
  assert.equal(whereLabel({ location: "Zoom", is_online: true }), "Online · Zoom");
  assert.equal(whereLabel({ location: null, is_online: false }), "");
  assert.equal(categoryLabel("GUEST_LECTURE"), "Guest lecture");
  assert.equal(categoryLabel("UNKNOWN"), "UNKNOWN");
  assert.equal(SPOTLIGHT_CATEGORIES.length, 8);
});

// ======================= spotlight admin =======================

test("what members see is not the same as 'published'", () => {
  assert.equal(spotlightState({ status: "PUBLISHED" }).label, "Live");
  assert.equal(spotlightState({ status: "PUBLISHED", is_scheduled: true }).label, "Scheduled");
  assert.equal(spotlightState({ status: "PUBLISHED", is_over: true }).label, "Ended");
  assert.equal(spotlightState({ status: "DRAFT" }).label, "Draft");
  assert.equal(spotlightState({ status: "ARCHIVED" }).label, "Archived");
  assert.ok(spotlightState({ status: "DRAFT" }).hint);
});

test("the status changes offered depend on the current status", () => {
  assert.deepEqual(spotlightActions({ status: "DRAFT" }).map((a) => a.status), ["PUBLISHED", "ARCHIVED"]);
  assert.deepEqual(spotlightActions({ status: "PUBLISHED" }).map((a) => a.status), ["DRAFT", "ARCHIVED"]);
  assert.deepEqual(spotlightActions({ status: "ARCHIVED" }).map((a) => a.status), ["DRAFT"]);
});

const validForm = () => ({ ...EMPTY_SPOTLIGHT_FORM, title: "Placement Drive", description: "Twelve companies are visiting." });

test("form: a minimal spotlight is valid; each rule reports on its own field", () => {
  assert.deepEqual(validateSpotlightForm(validForm()), {});
  assert.ok(validateSpotlightForm({ ...validForm(), title: "abc" }).title);
  assert.ok(validateSpotlightForm({ ...validForm(), description: "short" }).description);
  assert.ok(validateSpotlightForm({ ...validForm(), category: "PARTY" }).category);
  assert.match(validateSpotlightForm({ ...validForm(), starts_at: "2026-11-05T10:00", ends_at: "2026-11-05T09:00" }).ends_at, /before the start/);
  assert.match(validateSpotlightForm({ ...validForm(), ends_at: "2026-11-05T09:00" }).ends_at, /start before/);
  assert.ok(validateSpotlightForm({ ...validForm(), location: "x" }).location);
});

test("form: links must be https, and a button needs both its text and its link", () => {
  for (const bad of ["http://example.com/a.png", "javascript:alert(1)", "ftp://x.y"]) {
    assert.ok(validateSpotlightForm({ ...validForm(), image_url: bad }).image_url, bad);
    assert.ok(validateSpotlightForm({ ...validForm(), cta_label: "Go", cta_url: bad }).cta_url, bad);
  }
  assert.ok(validateSpotlightForm({ ...validForm(), cta_label: "Register" }).cta_url);
  assert.ok(validateSpotlightForm({ ...validForm(), cta_url: "https://example.com/r" }).cta_label);
  assert.deepEqual(validateSpotlightForm({ ...validForm(), image_url: "https://example.com/a.png", cta_label: "Register", cta_url: "https://example.com/r" }), {});
});

test("payload: emptied fields become null, status comes from the button, no author is sent", () => {
  const payload = spotlightToPayload({ ...validForm(), title: "  Placement Drive ", location: "  ", is_online: 1, created_by: 9, id: 3 }, "PUBLISHED");
  assert.deepEqual(payload, {
    title: "Placement Drive", description: "Twelve companies are visiting.", category: "EVENT", image_url: null, starts_at: null, ends_at: null,
    location: null, is_online: true, cta_label: null, cta_url: null, publish_at: null, status: "PUBLISHED",
  });
  assert.equal("status" in spotlightToPayload(validForm()), false); // editing keeps the current status
});

test("an existing spotlight round-trips through the form", () => {
  const saved = { title: "T itle", description: "Description here", category: "WORKSHOP", image_url: null, starts_at: "2026-11-05T09:30", ends_at: null, location: "Lab", is_online: 1, cta_label: null, cta_url: null, publish_at: null };
  const form = spotlightToForm(saved);
  assert.equal(form.image_url, "");
  assert.equal(form.is_online, true);
  assert.equal(form.starts_at, "2026-11-05T09:30");
  assert.deepEqual(spotlightToForm(null), { ...EMPTY_SPOTLIGHT_FORM });
  assert.deepEqual(spotlightToPayload(form).starts_at, "2026-11-05T09:30");
});

// ======================= home page helpers =======================

test("profile strength: a percentage and the single next step", () => {
  const empty = profileCompletion({ role: "STUDENT" });
  assert.equal(empty.percent, 0);
  assert.equal(empty.next.key, "photo");
  assert.equal(empty.total, 7);

  const student = profileCompletion({ role: "STUDENT", profile_photo: "x", bio: "Hi", skills: [1, 2, 3], resume_url: "https://x", projects: [1], location: "Bareilly", career_goals: "Grow" });
  assert.equal(student.percent, 100);
  assert.equal(student.next, null);

  const alumnus = profileCompletion({ role: "ALUMNI", profile_photo: "x", bio: "Hi", skills: [1, 2], company: "Acme", designation: "Engineer" });
  assert.equal(alumnus.next.key, "skills"); // two skills are not enough
  assert.equal(alumnus.steps.find((s) => s.key === "work").done, true);
  assert.ok(alumnus.steps.some((s) => s.key === "open_to"));
  assert.equal(profileCompletion(null).percent, 0);
});

test("why someone is suggested", () => {
  assert.equal(suggestionReason({ mutual_connections: 3 }), "3 mutual connections");
  assert.equal(suggestionReason({ mutual_connections: 1 }), "1 mutual connection");
  assert.equal(suggestionReason({ mutual_connections: 0, same_branch: true }), "Same branch as you");
  assert.equal(suggestionReason({ role: "ALUMNI" }), "SRMS alumnus");
  assert.equal(suggestionReason({ role: "STUDENT" }), "SRMS student");
});

// ======================= API client =======================

test("client: members read live cards; an empty response is an empty list", async () => {
  const http = fakeHttp({ spotlights: [{ id: 1 }] });
  assert.deepEqual(await createSpotlightClient(http).listSpotlights(), [{ id: 1 }]);
  assert.deepEqual(http.calls[0], { method: "get", url: "/spotlights", body: undefined, params: undefined });
  assert.deepEqual(await createSpotlightClient(fakeHttp(undefined)).listSpotlights(), []);
});

test("client: admin calls hit their own endpoints", async () => {
  const http = fakeHttp({ spotlights: [], counts: { PUBLISHED: 2 }, pagination: { page: 2, limit: 10, total: 12, totalPages: 2 } });
  const client = createSpotlightClient(http);

  const list = await client.manageList({ status: "DRAFT" }, 2, 10);
  await client.manageList();
  await client.createSpotlight({ title: "T" });
  await client.updateSpotlight(3, { title: "U" });
  await client.setSpotlightStatus(3, "PUBLISHED");
  await client.deleteSpotlight(3);

  assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), [
    "get /spotlights/manage", "get /spotlights/manage", "post /spotlights", "patch /spotlights/3", "patch /spotlights/3/status", "delete /spotlights/3",
  ]);
  assert.deepEqual(http.calls[0].params, { page: 2, limit: 10, status: "DRAFT" });
  assert.deepEqual(http.calls[1].params, { page: 1, limit: 20 }); // no status = everything
  assert.deepEqual(list.counts, { DRAFT: 0, PUBLISHED: 2, ARCHIVED: 0 });
  assert.equal(list.pagination.totalPages, 2);
  assert.deepEqual(http.calls[4].body, { status: "PUBLISHED" });
});
