// Career intents a user can publish on their profile ("Open to ...").
const OPEN_TO_INTENTS = ["MENTORSHIP", "REFERRALS", "RESUME_REVIEW", "MOCK_INTERVIEW", "HIRING"];

// Only alumni can be "Hiring": they are the ones who can post jobs.
const ALUMNI_ONLY_INTENTS = ["HIRING"];

module.exports = { OPEN_TO_INTENTS, ALUMNI_ONLY_INTENTS };
