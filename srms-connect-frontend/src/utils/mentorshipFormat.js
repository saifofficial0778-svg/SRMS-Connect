// Mentorship + warm introductions: labels, form validation, match wording, notification text.
// Pure (no React / axios / router imports) so it is unit tested with plain Node.
// The server enforces every rule again - this only drives the UI.

export const TOPICS = [
  { value: "CAREER_GUIDANCE", label: "Career guidance" },
  { value: "INTERVIEW_PREP", label: "Interview preparation" },
  { value: "RESUME_PORTFOLIO", label: "Resume & portfolio" },
  { value: "PLACEMENT_PREP", label: "Placement preparation" },
  { value: "HIGHER_STUDIES", label: "Higher studies" },
  { value: "PROJECT_GUIDANCE", label: "Project guidance" },
  { value: "SKILL_ROADMAP", label: "Learning roadmap" },
  { value: "INDUSTRY_INSIGHTS", label: "Industry insights" },
  { value: "ENTREPRENEURSHIP", label: "Entrepreneurship" },
  { value: "SOFT_SKILLS", label: "Communication & soft skills" },
];
export const topicLabel = (value) => TOPICS.find((t) => t.value === value)?.label || value || "";
const isTopic = (value) => TOPICS.some((t) => t.value === value);

// tone drives the badge colour; the label always carries the meaning
const MENTORSHIP_STATUS = {
  PENDING: { label: "Waiting for reply", tone: "pending" },
  ACTIVE: { label: "Active", tone: "positive" },
  REJECTED: { label: "Declined", tone: "negative" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
  COMPLETED: { label: "Completed", tone: "positive" },
};
const INTRO_STATUS = {
  PENDING: { label: "Waiting for reply", tone: "pending" },
  INTRODUCED: { label: "Introduced", tone: "positive" },
  DECLINED: { label: "Declined", tone: "negative" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
export const mentorshipStatus = (status) => MENTORSHIP_STATUS[status] || { label: status || "", tone: "muted" };
export const introStatus = (status) => INTRO_STATUS[status] || { label: status || "", tone: "muted" };
export const MENTORSHIP_STATUS_OPTIONS = Object.entries(MENTORSHIP_STATUS).map(([value, { label }]) => ({ value, label }));

const trimmed = (v) => String(v ?? "").trim();
const isWholeNumber = (v) => /^\d+$/.test(trimmed(v));
// "React, Node.js,," -> ["React", "Node.js"] (case-insensitive de-dupe)
export function parseList(text) {
  const seen = new Set();
  return trimmed(text)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ======================= mentor profile (alumni) =======================

export const EMPTY_MENTOR_FORM = Object.freeze({
  bio: "",
  availability: "",
  max_active_mentees: "3",
  is_accepting: true,
  topics: [],
  areas: "",
});

export function validateMentorProfile(form) {
  const errors = {};
  const bio = trimmed(form.bio).length;
  if (bio < 20) errors.bio = bio === 0 ? "Write a short bio for students." : "Bio must be at least 20 characters.";
  else if (bio > 600) errors.bio = "Bio must be at most 600 characters.";

  const availability = trimmed(form.availability).length;
  if (availability < 3) errors.availability = "Say when you are usually available.";
  else if (availability > 200) errors.availability = "Keep availability under 200 characters.";

  if (!isWholeNumber(form.max_active_mentees) || Number(form.max_active_mentees) < 1 || Number(form.max_active_mentees) > 20) {
    errors.max_active_mentees = "Enter a number between 1 and 20.";
  }

  const topics = (form.topics || []).filter(isTopic);
  if (topics.length === 0) errors.topics = "Choose at least one topic.";
  else if (topics.length > 6) errors.topics = "Choose at most 6 topics.";

  const areas = parseList(form.areas);
  if (areas.length > 5) errors.areas = "Add at most 5 areas.";
  else if (areas.some((a) => a.length < 2 || a.length > 100)) errors.areas = "Each area must be 2 to 100 characters.";

  return errors;
}

// the user id is never part of it: the server always writes the signed-in user's own profile
export function mentorProfileToPayload(form) {
  return {
    bio: trimmed(form.bio),
    availability: trimmed(form.availability),
    max_active_mentees: Number(form.max_active_mentees),
    is_accepting: Boolean(form.is_accepting),
    topics: (form.topics || []).filter(isTopic),
    areas: parseList(form.areas),
  };
}

export function mentorToForm(mentor) {
  if (!mentor) return { ...EMPTY_MENTOR_FORM };
  return {
    bio: mentor.bio || "",
    availability: mentor.availability || "",
    max_active_mentees: String(mentor.max_active_mentees ?? 3),
    is_accepting: Boolean(mentor.is_accepting),
    topics: [...(mentor.topics || [])],
    areas: (mentor.areas || []).join(", "),
  };
}

export const toggleTopic = (selected, value) => (selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

// ======================= mentor cards and matching =======================

export function spotsLabel(mentor) {
  if (!mentor.is_accepting) return "Not accepting mentees right now";
  if (mentor.spots_left === 0) return "No free spots right now";
  return `${mentor.spots_left} of ${mentor.max_active_mentees} ${mentor.max_active_mentees === 1 ? "spot" : "spots"} free`;
}
export const canRequestMentor = (mentor) => Boolean(mentor.is_accepting) && mentor.spots_left > 0;

// "86 of 104 points (83%)" - the score is always shown with what it is out of
export const matchSummary = (match) => (match ? `${match.score} of ${match.max_score} points (${match.percent}%)` : "");

// directory filters <-> URL <-> API
export const DEFAULT_MENTOR_FILTERS = Object.freeze({ q: "", topic: "", skills: "" });
export const MENTORS_PAGE_SIZE = 12;

export function urlToMentorFilters(searchParams) {
  const topic = trimmed(searchParams.get("topic"));
  const page = Number.parseInt(searchParams.get("page"), 10);
  return {
    filters: { q: trimmed(searchParams.get("q")), topic: isTopic(topic) ? topic : "", skills: trimmed(searchParams.get("skills")) },
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}
export function mentorFiltersToUrl(filters, page = 1) {
  const params = new URLSearchParams();
  for (const key of ["q", "topic", "skills"]) if (trimmed(filters[key])) params.set(key, trimmed(filters[key]));
  if (page > 1) params.set("page", String(page));
  return params;
}
// a one-letter search is not sent (the server needs 2+ characters)
export function mentorFiltersToApiParams(filters, page = 1, limit = MENTORS_PAGE_SIZE) {
  const params = { page, limit };
  if (trimmed(filters.q).length >= 2) params.q = trimmed(filters.q);
  if (filters.topic) params.topic = filters.topic;
  if (trimmed(filters.skills)) params.skills = parseList(filters.skills).join(",");
  return params;
}
// what matching is asked about: the same topic/skills, never a user
export function matchParams(filters) {
  const params = {};
  if (filters.topic) params.topic = filters.topic;
  if (trimmed(filters.skills)) params.skills = parseList(filters.skills).join(",");
  return params;
}
export const hasMentorFilters = (filters) => Boolean(trimmed(filters.q) || filters.topic || trimmed(filters.skills));

// ======================= mentorship requests =======================

export function validateMentorshipRequest(form, mentor) {
  const errors = {};
  if (!isTopic(form.topic)) errors.topic = "Choose what you want help with.";
  else if (mentor && !(mentor.topics || []).includes(form.topic)) errors.topic = "This mentor doesn't offer that topic.";

  const length = trimmed(form.message).length;
  if (length === 0) errors.message = "Tell the mentor what you'd like help with.";
  else if (length < 20) errors.message = "Please write at least 20 characters.";
  else if (length > 1000) errors.message = "Please keep it under 1000 characters.";

  const goals = parseGoals(form.goals);
  if (goals.length > 3) errors.goals = "Start with at most 3 goals. You can add more later.";
  else if (goals.some((g) => g.length < 3 || g.length > 200)) errors.goals = "Each goal must be 3 to 200 characters.";
  return errors;
}

// one goal per line
export const parseGoals = (text) => trimmed(text).split("\n").map((s) => s.trim()).filter(Boolean);

// the mentee is never part of it: the server takes it from the session
export function mentorshipRequestToPayload(form, mentorId) {
  return { mentor_id: Number(mentorId), topic: form.topic, message: trimmed(form.message), goals: parseGoals(form.goals) };
}

export const otherPerson = (mentorship) => (mentorship.my_role === "mentor" ? mentorship.mentee : mentorship.mentor);

export function mentorshipTitle(mentorship) {
  const other = otherPerson(mentorship)?.full_name || "Someone";
  if (mentorship.my_role === "mentor") {
    return mentorship.status === "PENDING" ? `${other} asked you to mentor them` : `Mentoring ${other}`;
  }
  return mentorship.status === "PENDING" ? `Mentorship request to ${other}` : `Mentorship with ${other}`;
}

// buttons for the actions the server says are possible (mentorship.actions)
const MENTORSHIP_ACTIONS = {
  ACCEPT: { label: "Accept", tone: "primary", note: "optional", noteLabel: "Add a welcome note (optional)" },
  REJECT: { label: "Decline", tone: "danger", note: "optional", noteLabel: "Reason (optional)" },
  CANCEL: { label: "Cancel request", tone: "danger", note: "none" },
  COMPLETE: { label: "Complete mentorship", tone: "secondary", note: "optional", noteLabel: "Closing note (optional)" },
};
export const mentorshipAction = (action) => MENTORSHIP_ACTIONS[action] || { label: action, tone: "secondary", note: "none" };

export function mentorshipHistoryLabel(entry, mentorship) {
  const mine = entry.by === mentorship.my_role;
  const who = entry.by === "system" ? null : mine ? "You" : (entry.by === "mentor" ? mentorship.mentor : mentorship.mentee)?.full_name || "They";
  const verbs = { PENDING: "sent the request", ACTIVE: "accepted - the mentorship started", REJECTED: "declined", CANCELLED: "cancelled the request", COMPLETED: "completed the mentorship" };
  return who ? `${who} ${verbs[entry.status] || entry.status.toLowerCase()}` : "Updated automatically";
}

export function goalProgress(goals) {
  const list = goals || [];
  const done = list.filter((g) => g.status === "DONE").length;
  return { done, total: list.length, label: list.length ? `${done} of ${list.length} done` : "No goals yet" };
}

export function validateGoal(title) {
  const length = trimmed(title).length;
  if (length < 3) return "A goal must be at least 3 characters.";
  if (length > 200) return "A goal must be at most 200 characters.";
  return "";
}

// today as YYYY-MM-DD in the viewer's own time zone
export const localToday = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

export function validateSession(form, today = localToday()) {
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed(form.session_date))) errors.session_date = "Choose the date of the session.";
  else if (form.session_date > today) errors.session_date = "Log a session after it has happened.";

  const duration = trimmed(form.duration_minutes);
  if (duration !== "" && (!isWholeNumber(duration) || Number(duration) < 5 || Number(duration) > 600)) {
    errors.duration_minutes = "Enter minutes between 5 and 600, or leave it empty.";
  }
  const notes = trimmed(form.notes).length;
  if (notes < 5) errors.notes = "Add a short note about what you covered.";
  else if (notes > 1000) errors.notes = "Keep notes under 1000 characters.";
  return errors;
}

export function sessionToPayload(form) {
  const duration = trimmed(form.duration_minutes);
  const payload = { session_date: trimmed(form.session_date), notes: trimmed(form.notes) };
  if (duration !== "") payload.duration_minutes = Number(duration);
  return payload;
}

export const durationLabel = (minutes) => (minutes ? `${minutes} min` : "");

// ======================= warm introductions =======================

export function validateIntro(form) {
  const errors = {};
  if (!form.introducer_id) errors.introducer_id = "Choose who should introduce you.";
  const length = trimmed(form.message).length;
  if (length === 0) errors.message = "Say why you'd like to be introduced.";
  else if (length < 20) errors.message = "Please write at least 20 characters.";
  else if (length > 600) errors.message = "Please keep it under 600 characters.";
  return errors;
}

// the requester is never part of it: the server takes it from the session
export const introToPayload = (form, targetId) => ({
  target_id: Number(targetId),
  introducer_id: Number(form.introducer_id),
  message: trimmed(form.message),
});

// what the intro page should offer for this target
//   connected -> no introduction needed;  existing -> one is already open;  no-path -> nobody in common
export function introPathState(paths) {
  if (!paths) return "loading";
  if (paths.already_connected) return "connected";
  if (paths.existing) return paths.existing.status === "INTRODUCED" ? "introduced" : "pending";
  if (!paths.can_request) return "not-allowed";
  if ((paths.introducers || []).length === 0) return "no-path";
  return "ready";
}

export function introTitle(intro) {
  const { requester, target, introducer } = intro;
  if (intro.my_role === "introducer") return `${requester.full_name} asked you to introduce them to ${target.full_name}`;
  if (intro.my_role === "target") return `${introducer.full_name} introduced ${requester.full_name} to you`;
  return `Introduction to ${target.full_name} through ${introducer.full_name}`;
}

const INTRO_ACTIONS = {
  INTRODUCE: { label: "Make the introduction", tone: "primary", note: "optional", noteLabel: "A few words about them (optional)" },
  DECLINE: { label: "Decline", tone: "danger", note: "optional", noteLabel: "Reason (optional)" },
  CANCEL: { label: "Cancel request", tone: "danger", note: "none" },
};
export const introAction = (action) => INTRO_ACTIONS[action] || { label: action, tone: "secondary", note: "none" };

// ======================= notifications =======================

// mentorship notification extra: "<event>|<topic code>|<text>"
export function mentorshipNotificationText(kind, extra) {
  const [event = "", topic = "", ...rest] = String(extra || "").split("|");
  const text = rest.join("|");
  const about = topicLabel(topic);

  if (kind === "MENTORSHIP_REQUEST") {
    return { message: `asked you to mentor them${about ? ` on ${about.toLowerCase()}` : ""}`, preview: text };
  }
  const messages = {
    ACTIVE: "accepted your mentorship request",
    REJECTED: "declined your mentorship request",
    COMPLETED: "completed your mentorship",
    GOAL_ADDED: "added a goal to your mentorship",
    GOAL_DONE: "marked a goal as done",
    SESSION: "logged a mentorship session",
  };
  return { message: messages[event] || "updated your mentorship", preview: text };
}

// intro notification extra: "<event>|<name of the other person>"
export function introNotificationText(kind, extra) {
  const [event = "", ...rest] = String(extra || "").split("|");
  const name = rest.join("|") || "someone";

  if (kind === "INTRO_REQUEST") return { message: `asked you to introduce them to ${name}`, preview: "" };
  const messages = {
    INTRODUCED: `introduced you to ${name}`,
    DECLINED: `couldn't introduce you to ${name}`,
    INTRODUCED_TO_YOU: `would like to introduce ${name} to you`,
  };
  return { message: messages[event] || "updated an introduction", preview: "" };
}
