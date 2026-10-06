// Job board + "Open to" helpers: labels, form validation, payload mapping.
// Pure (no React / axios / router imports) so everything here is unit tested with plain Node.
// The server validates everything again - this only gives instant, friendly feedback.

export const JOB_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "CONTRACT", label: "Contract" },
  { value: "FREELANCE", label: "Freelance" },
];

export const jobTypeLabel = (value) => JOB_TYPES.find((t) => t.value === value)?.label || value || "";

// "Fresher" / "2+ years" / "1-3 years"
export function experienceLabel(min, max) {
  const lo = Number(min) || 0;
  const hasMax = max !== null && max !== undefined && max !== "";
  if (!hasMax) return lo === 0 ? "Any experience" : `${lo}+ years`;
  const hi = Number(max);
  if (hi === 0) return "Fresher";
  if (lo === hi) return `${lo} ${lo === 1 ? "year" : "years"}`;
  return `${lo}-${hi} years`;
}

// Application links open in a new tab, so only plain https URLs are ever turned into a link
export function isSafeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const jobSubtitle = (job) => [job.company, job.location].filter(Boolean).join(" · ");

// ======================= Open to =======================

export const OPEN_TO_OPTIONS = [
  { value: "MENTORSHIP", label: "Mentorship", hint: "Guide students and juniors" },
  { value: "REFERRALS", label: "Referrals", hint: "Refer people to openings" },
  { value: "RESUME_REVIEW", label: "Resume review", hint: "Give feedback on resumes" },
  { value: "MOCK_INTERVIEW", label: "Mock interviews", hint: "Practice interviews together" },
  { value: "HIRING", label: "Hiring", hint: "Alumni only: you are hiring", alumniOnly: true },
];

export const openToLabel = (value) => OPEN_TO_OPTIONS.find((o) => o.value === value)?.label || value;

// options a person may choose (mirrors the server rule: Hiring is for alumni)
export const availableOpenToOptions = (role) =>
  OPEN_TO_OPTIONS.filter((o) => !o.alumniOnly || role === "ALUMNI");

export function toggleIntent(selected, value) {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

export const sameIntents = (a = [], b = []) => a.length === b.length && a.every((v) => b.includes(v));

// ======================= job form =======================

export const EMPTY_JOB_FORM = Object.freeze({
  title: "",
  company: "",
  location: "",
  job_type: "FULL_TIME",
  experience_min: "0",
  experience_max: "",
  description: "",
  apply_url: "",
  skills: "",
});

const LIMITS = { title: [3, 150], company: [2, 150], location: [2, 150], description: [20, 5000] };
const FIELD_LABELS = { title: "Title", company: "Company", location: "Location", description: "Description" };
const MAX_SKILLS = 10;

export const parseSkills = (text) => {
  const seen = new Set();
  return String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const isWholeNumber = (v) => /^\d+$/.test(String(v).trim());

// -> { field: "message" } (empty object = valid)
export function validateJobForm(form) {
  const errors = {};

  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const length = String(form[field] || "").trim().length;
    if (length < min) {
      errors[field] = length === 0 ? `${FIELD_LABELS[field]} is required.` : `${FIELD_LABELS[field]} must be at least ${min} characters.`;
    } else if (length > max) {
      errors[field] = `${FIELD_LABELS[field]} must be at most ${max} characters.`;
    }
  }

  if (!JOB_TYPES.some((t) => t.value === form.job_type)) errors.job_type = "Choose a job type.";

  const minRaw = String(form.experience_min ?? "").trim();
  const maxRaw = String(form.experience_max ?? "").trim();
  if (minRaw !== "" && (!isWholeNumber(minRaw) || Number(minRaw) > 40)) {
    errors.experience_min = "Enter whole years between 0 and 40.";
  }
  if (maxRaw !== "") {
    if (!isWholeNumber(maxRaw) || Number(maxRaw) > 40) errors.experience_max = "Enter whole years between 0 and 40.";
    else if (!errors.experience_min && Number(maxRaw) < Number(minRaw || 0)) {
      errors.experience_max = "Maximum can't be lower than minimum.";
    }
  }

  const url = String(form.apply_url || "").trim();
  if (!url) errors.apply_url = "Application link is required.";
  else if (!isSafeHttpsUrl(url)) errors.apply_url = "Use a secure link starting with https://";

  const skills = parseSkills(form.skills);
  if (skills.length > MAX_SKILLS) errors.skills = `Add at most ${MAX_SKILLS} skills.`;
  else if (skills.some((s) => s.length > 50)) errors.skills = "Each skill must be 50 characters or fewer.";

  return errors;
}

// form state -> API body (the server ignores anything not on this list anyway)
export function formToPayload(form) {
  const maxRaw = String(form.experience_max ?? "").trim();
  return {
    title: form.title.trim(),
    company: form.company.trim(),
    location: form.location.trim(),
    job_type: form.job_type,
    experience_min: Number(String(form.experience_min ?? "").trim() || 0),
    experience_max: maxRaw === "" ? null : Number(maxRaw),
    description: form.description.trim(),
    apply_url: form.apply_url.trim(),
    skills: parseSkills(form.skills),
  };
}

// job from the API -> form state (for editing)
export function jobToForm(job) {
  return {
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    job_type: job.job_type || "FULL_TIME",
    experience_min: String(job.experience_min ?? 0),
    experience_max: job.experience_max === null || job.experience_max === undefined ? "" : String(job.experience_max),
    description: job.description || "",
    apply_url: job.apply_url || "",
    skills: (job.skills || []).join(", "),
  };
}

// The API answers validation failures with { errors: [{ path: ["apply_url"], message }] }
export function extractFieldErrors(error) {
  const issues = error?.response?.data?.errors;
  const result = {};
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      const field = Array.isArray(issue.path) ? issue.path[0] : issue.path;
      if (field && !result[field]) result[field] = issue.message;
    }
  }
  return result;
}
