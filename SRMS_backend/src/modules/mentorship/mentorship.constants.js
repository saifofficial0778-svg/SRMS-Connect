// What a mentor can offer help with. Stored as the code; the client shows the label.
const TOPICS = [
    "CAREER_GUIDANCE",
    "INTERVIEW_PREP",
    "RESUME_PORTFOLIO",
    "PLACEMENT_PREP",
    "HIGHER_STUDIES",
    "PROJECT_GUIDANCE",
    "SKILL_ROADMAP",
    "INDUSTRY_INSIGHTS",
    "ENTREPRENEURSHIP",
    "SOFT_SKILLS",
];

const STATUSES = ["PENDING", "ACTIVE", "REJECTED", "CANCELLED", "COMPLETED"];

// Who may be a mentor and who may ask for one. Changing these is all it takes to widen the flow.
const MENTOR_ROLE = "ALUMNI";
const MENTEE_ROLES = ["STUDENT"];

const LIMITS = {
    MAX_TOPICS: 6,
    MAX_AREAS: 5,
    MAX_PENDING_PER_MENTEE: 5, // outstanding requests a student may have at once
    MAX_GOALS: 10,
    MAX_SESSIONS: 200,
    INITIAL_GOALS: 3,
};

// Transparent matching rules: every point a mentor gets is listed with its reason.
const MATCH_WEIGHTS = {
    TOPIC: 30, // mentors on the topic you asked for
    REQUESTED_SKILL: 10, // each skill you asked about that they have ...
    REQUESTED_SKILL_MAX: 30, // ... up to this many points
    GAP_SKILL: 8, // each of your top missing skills (from My Skill Gap) that they have ...
    GAP_SKILL_MAX: 24, // ... up to this many points
    OPEN_TO: 10, // their profile says "Open to: Mentorship"
    AREA: 10, // they prefer mentoring students from your branch
    CONNECTED: 10, // you are already connected
};
const GAP_SKILLS_CONSIDERED = 10;

module.exports = { TOPICS, STATUSES, MENTOR_ROLE, MENTEE_ROLES, LIMITS, MATCH_WEIGHTS, GAP_SKILLS_CONSIDERED };
