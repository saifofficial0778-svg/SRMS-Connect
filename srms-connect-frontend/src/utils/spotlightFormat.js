// Campus Spotlight: labels, dates, the admin form and profile completion.
// Pure (no React / axios / router imports) so it is unit tested with plain Node.

import { isSafeHttpsUrl } from "./jobFormat.js";

export const SPOTLIGHT_CATEGORIES = [
  { value: "EVENT", label: "Event" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "PLACEMENT", label: "Placement drive" },
  { value: "GUEST_LECTURE", label: "Guest lecture" },
  { value: "SEMINAR", label: "Seminar" },
  { value: "HACKATHON", label: "Hackathon" },
  { value: "PROGRAM", label: "Programme" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
];
export const categoryLabel = (value) => SPOTLIGHT_CATEGORIES.find((c) => c.value === value)?.label || value || "";
const isCategory = (value) => SPOTLIGHT_CATEGORIES.some((c) => c.value === value);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "2026-11-05T14:30" -> parts, read as written (campus local time; never shifted by a time zone)
export function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ""));
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const weekday = new Date(y, mo - 1, d).getDay();
  return { year: y, month: mo, day: d, hour: h, minute: mi, weekday };
}

const clock = ({ hour, minute }) => `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "AM" : "PM"}`;

// the calendar tile on a card: { month: "NOV", day: "5" }
export function dateBadge(value) {
  const p = parseLocalDateTime(value);
  return p ? { month: MONTHS[p.month - 1].toUpperCase(), day: String(p.day) } : null;
}

// "Thu, 5 Nov · 2:30 PM" / "Thu, 5 Nov · 9:30 AM – 5 PM" / "5 Nov – 7 Nov"
export function whenLabel(startsAt, endsAt) {
  const start = parseLocalDateTime(startsAt);
  if (!start) return "";
  const day = (p) => `${p.day} ${MONTHS[p.month - 1]}`;
  const end = parseLocalDateTime(endsAt);
  const first = `${WEEKDAYS[start.weekday]}, ${day(start)} · ${clock(start)}`;
  if (!end) return first;
  const sameDay = end.year === start.year && end.month === start.month && end.day === start.day;
  return sameDay ? `${first} – ${clock(end)}` : `${day(start)} – ${day(end)}`;
}

export function whereLabel(spotlight) {
  if (spotlight.is_online) return spotlight.location ? `Online · ${spotlight.location}` : "Online";
  return spotlight.location || "";
}

// ======================= admin =======================

const STATUS_META = {
  DRAFT: { label: "Draft", tone: "muted" },
  PUBLISHED: { label: "Published", tone: "positive" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};
// what members actually see is not the same as "published": it may be scheduled or already over
export function spotlightState(spotlight) {
  if (spotlight.status === "PUBLISHED" && spotlight.is_scheduled) return { label: "Scheduled", tone: "pending", hint: "Appears to members at the publish time" };
  if (spotlight.status === "PUBLISHED" && spotlight.is_over) return { label: "Ended", tone: "neutral", hint: "The event is over, so members no longer see it" };
  if (spotlight.status === "PUBLISHED") return { label: "Live", tone: "positive", hint: "Members see this on their home page" };
  return { ...(STATUS_META[spotlight.status] || { label: spotlight.status, tone: "muted" }), hint: spotlight.status === "DRAFT" ? "Only admins can see drafts" : "Hidden from members" };
}

// the status changes an admin can make from each state
export function spotlightActions(spotlight) {
  if (spotlight.status === "DRAFT") return [{ status: "PUBLISHED", label: "Publish" }, { status: "ARCHIVED", label: "Archive" }];
  if (spotlight.status === "PUBLISHED") return [{ status: "DRAFT", label: "Unpublish" }, { status: "ARCHIVED", label: "Archive" }];
  return [{ status: "DRAFT", label: "Restore as draft" }];
}

export const SPOTLIGHT_FILTERS = [
  { value: "", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ARCHIVED", label: "Archived" },
];

export const EMPTY_SPOTLIGHT_FORM = Object.freeze({
  title: "", description: "", category: "EVENT", image_url: "", starts_at: "", ends_at: "",
  location: "", is_online: false, cta_label: "", cta_url: "", publish_at: "",
});

const trimmed = (v) => String(v ?? "").trim();
const isLocalDateTime = (v) => parseLocalDateTime(v) !== null;

export function validateSpotlightForm(form) {
  const errors = {};
  const title = trimmed(form.title).length;
  if (title < 4) errors.title = "Give it a title of at least 4 characters.";
  else if (title > 120) errors.title = "Keep the title under 120 characters.";

  const description = trimmed(form.description).length;
  if (description < 10) errors.description = "Describe it in at least 10 characters.";
  else if (description > 600) errors.description = "Keep the description under 600 characters.";

  if (!isCategory(form.category)) errors.category = "Choose a category.";
  if (trimmed(form.image_url) && !isSafeHttpsUrl(form.image_url)) errors.image_url = "Use a secure https:// link to the image.";

  if (trimmed(form.starts_at) && !isLocalDateTime(form.starts_at)) errors.starts_at = "Choose a valid date and time.";
  if (trimmed(form.ends_at) && !isLocalDateTime(form.ends_at)) errors.ends_at = "Choose a valid date and time.";
  else if (trimmed(form.ends_at) && !trimmed(form.starts_at)) errors.ends_at = "Add a start before an end.";
  else if (trimmed(form.ends_at) && form.ends_at < form.starts_at) errors.ends_at = "The end can't be before the start.";

  const label = trimmed(form.cta_label);
  const url = trimmed(form.cta_url);
  if (url && !isSafeHttpsUrl(url)) errors.cta_url = "Use a secure https:// link.";
  else if (label && !url) errors.cta_url = "Add the link the button opens.";
  if (url && !label) errors.cta_label = "Add the button text.";
  else if (label && (label.length < 2 || label.length > 40)) errors.cta_label = "Button text must be 2 to 40 characters.";

  if (trimmed(form.location).length === 1 || trimmed(form.location).length > 150) errors.location = "Location must be 2 to 150 characters.";
  if (trimmed(form.publish_at) && !isLocalDateTime(form.publish_at)) errors.publish_at = "Choose a valid date and time.";
  return errors;
}

// status is chosen by the button pressed (save as draft / publish), never typed
export function spotlightToPayload(form, status) {
  const orNull = (v) => (trimmed(v) ? trimmed(v) : null);
  const payload = {
    title: trimmed(form.title),
    description: trimmed(form.description),
    category: form.category,
    image_url: orNull(form.image_url),
    starts_at: orNull(form.starts_at),
    ends_at: orNull(form.ends_at),
    location: orNull(form.location),
    is_online: Boolean(form.is_online),
    cta_label: orNull(form.cta_label),
    cta_url: orNull(form.cta_url),
    publish_at: orNull(form.publish_at),
  };
  if (status) payload.status = status;
  return payload;
}

export function spotlightToForm(spotlight) {
  if (!spotlight) return { ...EMPTY_SPOTLIGHT_FORM };
  const text = (v) => v || "";
  return {
    title: text(spotlight.title), description: text(spotlight.description), category: spotlight.category || "EVENT",
    image_url: text(spotlight.image_url), starts_at: text(spotlight.starts_at), ends_at: text(spotlight.ends_at),
    location: text(spotlight.location), is_online: Boolean(spotlight.is_online),
    cta_label: text(spotlight.cta_label), cta_url: text(spotlight.cta_url), publish_at: text(spotlight.publish_at),
  };
}

// ======================= profile completion (home page) =======================

// What makes a profile useful to other members, in the order worth doing them.
// Returns the percentage and the next thing to add - never a nag about everything at once.
export function profileCompletion(profile) {
  if (!profile) return { percent: 0, done: 0, total: 0, next: null, steps: [] };
  const isAlumni = profile.role === "ALUMNI";
  const has = (v) => Boolean(String(v ?? "").trim());
  const steps = [
    { key: "photo", label: "Add a profile photo", done: has(profile.profile_photo) },
    { key: "bio", label: "Write a short bio", done: has(profile.bio) },
    { key: "skills", label: "List at least 3 skills", done: (profile.skills || []).length >= 3 },
    isAlumni
      ? { key: "work", label: "Add your company and role", done: has(profile.company) && has(profile.designation) }
      : { key: "resume", label: "Add a link to your resume", done: has(profile.resume_url) },
    { key: "projects", label: "Add a project", done: (profile.projects || []).length >= 1 },
    { key: "location", label: "Add your location", done: has(profile.location) },
    isAlumni
      ? { key: "open_to", label: "Say what you are open to", done: (profile.open_to || []).length >= 1 }
      : { key: "goals", label: "Add your career goals", done: has(profile.career_goals) },
  ];
  const done = steps.filter((s) => s.done).length;
  return { percent: Math.round((done / steps.length) * 100), done, total: steps.length, next: steps.find((s) => !s.done) || null, steps };
}

// why someone is suggested, in a few words
export function suggestionReason(person) {
  const mutual = Number(person?.mutual_connections) || 0;
  if (mutual > 0) return `${mutual} mutual ${mutual === 1 ? "connection" : "connections"}`;
  if (person?.same_branch) return "Same branch as you";
  return person?.role === "ALUMNI" ? "SRMS alumnus" : "SRMS student";
}
