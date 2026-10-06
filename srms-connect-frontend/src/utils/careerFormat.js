// Career help (referrals, resume reviews, "Ask an Alumni"): labels, form validation, dashboard
// filters and notification text. Pure (no React / axios / router imports) so it is unit tested with
// plain Node. The server enforces every rule again - this only drives the UI.

import { isSafeHttpsUrl } from "./jobFormat.js";

export const REQUEST_TYPES = [
  {
    value: "REFERRAL",
    label: "Referral",
    plural: "Referrals",
    noun: "a referral",
    hint: "Ask a connected alumnus to refer you for a specific job.",
    messageLabel: "Why are you a good fit?",
    messagePlaceholder: "A short note on your relevant projects, skills and why this role.",
    limits: [20, 600],
    needsJob: true,
    resume: "optional",
  },
  {
    value: "RESUME_REVIEW",
    label: "Resume review",
    plural: "Resume reviews",
    noun: "a resume review",
    hint: "Ask a connected alumnus for feedback on your resume.",
    messageLabel: "What should they look at?",
    messagePlaceholder: "The roles you are targeting and anything you want feedback on.",
    limits: [10, 600],
    needsJob: false,
    resume: "required",
  },
  {
    value: "QUESTION",
    label: "Question",
    plural: "Questions",
    noun: "a question",
    hint: "Ask a career question to an alumnus you know, or one who is open to mentorship.",
    messageLabel: "Your question",
    messagePlaceholder: "Be specific so it is easy to answer well.",
    limits: [15, 1000],
    needsJob: false,
    resume: "none",
  },
];

export const typeMeta = (type) => REQUEST_TYPES.find((t) => t.value === type) || REQUEST_TYPES[0];
export const isRequestType = (value) => REQUEST_TYPES.some((t) => t.value === value);

// tone drives the badge colour
export const STATUS_META = {
  PENDING: { label: "Waiting for reply", tone: "pending" },
  ACCEPTED: { label: "Accepted", tone: "positive" },
  REJECTED: { label: "Declined", tone: "negative" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
  COMPLETED: { label: "Completed", tone: "positive" },
  ANSWERED: { label: "Answered", tone: "positive" },
};
export const statusMeta = (status) => STATUS_META[status] || { label: status || "", tone: "muted" };
export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, { label }]) => ({ value, label }));

// Buttons for the actions the server says are possible (request.actions).
// response: "required" | "optional" | "none"
const ACTION_META = {
  ACCEPT: { label: "Accept", tone: "primary", response: "optional", responseLabel: "Add a note (optional)" },
  REJECT: { label: "Decline", tone: "danger", response: "optional", responseLabel: "Reason (optional)" },
  ANSWER: { label: "Answer", tone: "primary", response: "required", responseLabel: "Your answer" },
  CANCEL: { label: "Cancel request", tone: "danger", response: "none" },
};

export function actionMeta(action, type) {
  if (action === "COMPLETE") {
    return type === "REFERRAL"
      ? { label: "Mark as referred", tone: "primary", response: "optional", responseLabel: "Add a note (optional)" }
      : { label: "Send feedback", tone: "primary", response: "optional", responseLabel: "Your feedback (optional)" };
  }
  return ACTION_META[action] || { label: action, tone: "secondary", response: "none" };
}

// -> error message, or "" when the response text is fine for this action
export function validateResponse(action, type, text) {
  const value = String(text || "").trim();
  const { response } = actionMeta(action, type);
  if (response === "required" && value.length < 10) return "Please write at least 10 characters.";
  if (value.length > 2000) return "Please keep it under 2000 characters.";
  return "";
}

// the other person in a request, from the viewer's side
export const counterpart = (request) => (request.direction === "sent" ? request.alumni : request.requester);

// one-line summary for cards: "Referral request to Arjun Verma" / "Aarav Sharma asked for a referral"
export function requestTitle(request) {
  const meta = typeMeta(request.type);
  const other = counterpart(request)?.full_name || "Someone";
  if (request.direction === "sent") {
    return request.type === "QUESTION" ? `Question for ${other}` : `${meta.label} request to ${other}`;
  }
  return request.type === "QUESTION" ? `${other} asked a question` : `${other} asked for ${meta.noun}`;
}

export const jobLine = (job) => (job ? [job.title, job.company].filter(Boolean).join(" at ") : "");

// history entry -> "You sent the request" / "Arjun Verma accepted" / "Closed automatically"
export function historyLabel(entry, request) {
  const mine = (entry.by === "requester") === (request.direction === "sent");
  const who =
    entry.by === "system"
      ? null
      : mine
        ? "You"
        : (entry.by === "requester" ? request.requester : request.alumni)?.full_name || "They";
  const verbs = {
    PENDING: "sent the request",
    ACCEPTED: "accepted",
    REJECTED: "declined",
    CANCELLED: "cancelled the request",
    COMPLETED: request.type === "REFERRAL" ? "marked it as referred" : "sent feedback",
    ANSWERED: "answered",
  };
  if (!who) return entry.note || "Closed automatically";
  return `${who} ${verbs[entry.status] || entry.status.toLowerCase()}`;
}

// why this alumnus is a good person to ask (shown as small tags in the picker)
export function alumniTags(alumnus, type) {
  const tags = [];
  if (alumnus.is_job_poster) tags.push("Posted this job");
  if (alumnus.same_company) tags.push("Works at this company");
  if (alumnus.is_open_to) {
    tags.push(type === "REFERRAL" ? "Open to referrals" : type === "RESUME_REVIEW" ? "Open to resume reviews" : "Open to mentorship");
  }
  return tags;
}

// ======================= new request form =======================

export const EMPTY_REQUEST_FORM = Object.freeze({ type: "REFERRAL", alumni_id: "", job_id: "", message: "", resume_url: "" });

// -> { field: "message" } (empty object = valid)
export function validateRequestForm(form) {
  const errors = {};
  const meta = typeMeta(form.type);

  if (!isRequestType(form.type)) errors.type = "Choose what you need help with.";
  if (!form.alumni_id) errors.alumni_id = "Choose an alumnus to ask.";
  if (meta.needsJob && !form.job_id) errors.job_id = "A referral request must be for a specific job.";

  const length = String(form.message || "").trim().length;
  const [min, max] = meta.limits;
  if (length === 0) errors.message = "Please write a short note.";
  else if (length < min) errors.message = `Please write at least ${min} characters.`;
  else if (length > max) errors.message = `Please keep it under ${max} characters.`;

  const url = String(form.resume_url || "").trim();
  if (meta.resume === "required" && !url) errors.resume_url = "Add a link to your resume.";
  else if (meta.resume !== "none" && url && !isSafeHttpsUrl(url)) errors.resume_url = "Use a secure link starting with https://";

  return errors;
}

// form state -> API body. The requester is never part of it: the server takes it from the session.
export function requestFormToPayload(form) {
  const meta = typeMeta(form.type);
  const payload = { type: form.type, alumni_id: Number(form.alumni_id), message: form.message.trim() };
  if (meta.needsJob) payload.job_id = Number(form.job_id);
  const url = String(form.resume_url || "").trim();
  if (meta.resume !== "none" && url) payload.resume_url = url;
  return payload;
}

// ======================= dashboard filters <-> URL <-> API =======================

export const CAREER_PAGE_SIZE = 10;

export function defaultBox({ canRequest, canRespond } = {}) {
  return canRespond && !canRequest ? "received" : "sent";
}

export function urlToCareerFilters(searchParams) {
  const box = searchParams.get("box");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const page = Number.parseInt(searchParams.get("page"), 10);
  return {
    filters: {
      box: box === "sent" || box === "received" ? box : "", // "" = let the role decide
      type: isRequestType(type) ? type : "",
      status: STATUS_META[status] ? status : "",
    },
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export function careerFiltersToUrl(filters, page = 1) {
  const params = new URLSearchParams();
  if (filters.box) params.set("box", filters.box);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  return params;
}

export function careerFiltersToApiParams(filters, page = 1, limit = CAREER_PAGE_SIZE) {
  const params = { box: filters.box || "sent", page, limit };
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  return params;
}

// ======================= notifications =======================

// notification.extra for career notifications is "<request type>|<status>|<what it is about>"
export function parseCareerExtra(extra) {
  const [requestType = "", status = "", ...rest] = String(extra || "").split("|");
  return { requestType: isRequestType(requestType) ? requestType : "", status, text: rest.join("|") };
}

// -> { message, preview } for the notification list.
// `system` = there is no person behind it (e.g. a request closed because its job was removed),
// so the message is a full sentence instead of "<name> did something".
export function careerNotificationText(kind, extra, { system = false } = {}) {
  const { requestType, status, text } = parseCareerExtra(extra);
  const noun = requestType ? typeMeta(requestType).noun : "help";
  const label = requestType ? typeMeta(requestType).label.toLowerCase() : "career";

  if (kind === "CAREER_REQUEST") {
    return { message: requestType === "QUESTION" ? "asked you a question" : `asked you for ${noun}`, preview: text };
  }

  if (system) {
    return { message: `Your ${label} request was closed.`, preview: text };
  }

  const subject = requestType === "QUESTION" ? "your question" : `your ${label} request`;
  const messages = {
    ACCEPTED: `accepted ${subject}`,
    REJECTED: `declined ${subject}`,
    ANSWERED: "answered your question",
    COMPLETED: requestType === "REFERRAL" ? "referred you" : "sent feedback on your resume",
    CANCELLED: `withdrew their ${label} request`,
  };
  return { message: messages[status] || "updated a request", preview: text };
}
