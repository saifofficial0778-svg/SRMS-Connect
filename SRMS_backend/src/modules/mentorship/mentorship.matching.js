const { MATCH_WEIGHTS: W } = require("./mentorship.constants");

// Rule-based mentor matching. Pure (no DB access) so the rules can be tested directly, and every
// point awarded comes with the reason for it - there is no hidden weighting.
//
//   mentor  { user_id, topics: [code], areas: [text], skills: [{ key, name }], open_to_mentorship }
//   context { topic, requestedSkills: [{ key, name }], gapSkills: [{ key, name }], branch, connectedIds: Set }
//
// -> { score, max_score, percent, reasons: [{ code, points, text }] }
function scoreMentor(mentor, context) {
    const { topic, requestedSkills = [], gapSkills = [], branch, connectedIds = new Set() } = context;
    const mentorSkillKeys = new Set((mentor.skills || []).map((s) => s.key));
    const reasons = [];
    let maxScore = W.OPEN_TO + W.CONNECTED;

    if (topic) {
        maxScore += W.TOPIC;
        if ((mentor.topics || []).includes(topic)) {
            reasons.push({ code: "TOPIC", points: W.TOPIC, text: "Mentors on the topic you chose" });
        }
    }

    if (requestedSkills.length) {
        maxScore += Math.min(W.REQUESTED_SKILL_MAX, requestedSkills.length * W.REQUESTED_SKILL);
        const hit = requestedSkills.filter((s) => mentorSkillKeys.has(s.key));
        if (hit.length) {
            reasons.push({
                code: "REQUESTED_SKILL",
                points: Math.min(W.REQUESTED_SKILL_MAX, hit.length * W.REQUESTED_SKILL),
                text: `Has ${hit.length === 1 ? "a skill" : "skills"} you asked about: ${hit.map((s) => s.name).join(", ")}`,
            });
        }
    }

    if (gapSkills.length) {
        maxScore += Math.min(W.GAP_SKILL_MAX, gapSkills.length * W.GAP_SKILL);
        // a skill already counted as "asked about" is not counted again as a gap
        const asked = new Set(requestedSkills.map((s) => s.key));
        const hit = gapSkills.filter((s) => mentorSkillKeys.has(s.key) && !asked.has(s.key));
        if (hit.length) {
            reasons.push({
                code: "GAP_SKILL",
                points: Math.min(W.GAP_SKILL_MAX, hit.length * W.GAP_SKILL),
                text: `Knows ${hit.length === 1 ? "a skill" : "skills"} from your skill gap: ${hit.map((s) => s.name).join(", ")}`,
            });
        }
    }

    if (mentor.open_to_mentorship) {
        reasons.push({ code: "OPEN_TO", points: W.OPEN_TO, text: "Open to mentorship on their profile" });
    }

    if (branch) {
        maxScore += W.AREA;
        const mine = branch.trim().toLowerCase();
        const area = (mentor.areas || []).find((a) => {
            const theirs = a.trim().toLowerCase();
            return theirs && (mine.includes(theirs) || theirs.includes(mine));
        });
        if (area) {
            reasons.push({ code: "AREA", points: W.AREA, text: `Prefers mentoring students from ${area}` });
        }
    }

    if (connectedIds.has(mentor.user_id)) {
        reasons.push({ code: "CONNECTED", points: W.CONNECTED, text: "You are already connected" });
    }

    const score = reasons.reduce((sum, r) => sum + r.points, 0);
    return {
        score,
        max_score: maxScore,
        percent: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
        reasons,
    };
}

// Mentors with a free spot first, then by score, then by name (so the order is stable).
function rankMentors(mentors, context) {
    return mentors
        .map((mentor) => ({ ...mentor, match: scoreMentor(mentor, context) }))
        .sort(
            (a, b) =>
                Number(b.spots_left > 0) - Number(a.spots_left > 0) ||
                b.match.score - a.match.score ||
                String(a.full_name || "").localeCompare(String(b.full_name || ""))
        );
}

module.exports = { scoreMentor, rankMentors };
