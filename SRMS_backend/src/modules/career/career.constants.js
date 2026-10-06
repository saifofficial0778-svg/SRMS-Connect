// Career help: referral requests, resume reviews and "Ask an Alumni" questions.

const REQUEST_TYPES = ["REFERRAL", "RESUME_REVIEW", "QUESTION"];
const STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED", "ANSWERED"];

// a request in one of these states blocks a duplicate (see the unique key in migration 0010)
const ACTIVE_STATUSES = ["PENDING", "ACCEPTED"];

// Who may ask, and who may be asked. Changing these two constants is all it takes to open the
// flows to other roles later.
const REQUESTER_ROLES = ["STUDENT"];
const RESPONDER_ROLE = "ALUMNI";

// What the alumnus can do, per type: action -> allowed current status and resulting status.
const RESPOND_ACTIONS = {
    REFERRAL: {
        ACCEPT: { from: "PENDING", to: "ACCEPTED" },
        REJECT: { from: "PENDING", to: "REJECTED" },
        COMPLETE: { from: "ACCEPTED", to: "COMPLETED" }, // referral submitted
    },
    RESUME_REVIEW: {
        ACCEPT: { from: "PENDING", to: "ACCEPTED" },
        REJECT: { from: "PENDING", to: "REJECTED" },
        COMPLETE: { from: "ACCEPTED", to: "COMPLETED" }, // feedback given
    },
    QUESTION: {
        ANSWER: { from: "PENDING", to: "ANSWERED", responseRequired: true },
        REJECT: { from: "PENDING", to: "REJECTED" },
    },
};

// states from which the student can still withdraw
const CANCELLABLE_FROM = {
    REFERRAL: ["PENDING", "ACCEPTED"],
    RESUME_REVIEW: ["PENDING", "ACCEPTED"],
    QUESTION: ["PENDING"],
};

// the "Open to" intent that marks an alumnus as a good match for each type
const OPEN_TO_FOR_TYPE = { REFERRAL: "REFERRALS", RESUME_REVIEW: "RESUME_REVIEW", QUESTION: "MENTORSHIP" };

// message length per type: [min, max]
const MESSAGE_LIMITS = { REFERRAL: [20, 600], RESUME_REVIEW: [10, 600], QUESTION: [15, 1000] };

const MAX_PENDING_PER_REQUESTER = 20; // simple anti-spam cap on outstanding requests

module.exports = {
    REQUEST_TYPES,
    STATUSES,
    ACTIVE_STATUSES,
    REQUESTER_ROLES,
    RESPONDER_ROLE,
    RESPOND_ACTIONS,
    CANCELLABLE_FROM,
    OPEN_TO_FOR_TYPE,
    MESSAGE_LIMITS,
    MAX_PENDING_PER_REQUESTER,
};
