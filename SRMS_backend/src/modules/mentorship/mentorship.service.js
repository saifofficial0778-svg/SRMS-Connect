const MentorshipRepository = require("./mentorship.repository");
const NotificationService = require("../notification/notification.service");
const SkillService = require("../skill/skill.service");
const InsightService = require("../insight/insight.service");
const AppError = require("../../utils/AppError");
const { rankMentors, scoreMentor } = require("./mentorship.matching");
const { MENTOR_ROLE, MENTEE_ROLES, LIMITS, MATCH_WEIGHTS, GAP_SKILLS_CONSIDERED } = require("./mentorship.constants");

const MATCH_POOL = 200; // most mentors scored for one matching request
const MATCH_RESULTS = 10;

const parseId = (value, label = "id") => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw new AppError(`Invalid ${label}`, 400);
    }
    return id;
};

const shorten = (text, max = 90) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

// extra for mentorship notifications: "<event>|<topic code>|<text>"; the client writes the sentence
const notifyExtra = (event, topic, text = "") => `${event}|${topic}|${text}`;
const requestKey = (id) => `MENTORSHIP:${id}:PENDING`;

// ---------- shaping ----------

// Internal mentor record (skills keep their keys so they can be scored) from the pieces loaded
// for a page of mentors.
function assembleMentor(row, tagsByMentor, skillsByProfile, openTo) {
    const tags = tagsByMentor[row.user_id] || { topics: [], areas: [] };
    const active = Number(row.active_mentees);
    return {
        user_id: row.user_id,
        full_name: row.full_name || "SRMS Alumni",
        profile_photo: row.profile_photo,
        designation: row.designation,
        company: row.company,
        batch_year: row.batch_year,
        is_verified_alumni: row.role === MENTOR_ROLE,
        bio: row.bio,
        availability: row.availability,
        topics: tags.topics,
        areas: tags.areas,
        skills: skillsByProfile[row.profile_id] || [],
        open_to_mentorship: openTo.has(row.user_id),
        is_accepting: Boolean(row.is_accepting),
        max_active_mentees: row.max_active_mentees,
        active_mentees: active,
        spots_left: Math.max(0, row.max_active_mentees - active),
    };
}

// What leaves the API: the same record with skills as plain names. Nothing here is private -
// it is what the mentor chose to publish plus their public profile fields.
const toPublicMentor = (mentor) => ({ ...mentor, skills: mentor.skills.map((s) => s.name) });

async function loadMentors(rows) {
    const userIds = rows.map((r) => r.user_id);
    const profileIds = rows.map((r) => r.profile_id).filter(Boolean);
    const [tags, skills, openTo] = await Promise.all([
        MentorshipRepository.findTagsForMentors(userIds),
        MentorshipRepository.findSkillsForProfiles(profileIds),
        MentorshipRepository.findOpenToMentorship(userIds),
    ]);
    return rows.map((row) => assembleMentor(row, tags, skills, openTo));
}

// Everything the matching rules need about the person asking. All of it is the viewer's own data
// or platform-wide counts.
async function loadMatchContext(viewer, { topic, skills } = {}) {
    const [connectedIds, branch, gap, requestedSkills] = await Promise.all([
        MentorshipRepository.findConnectedUserIds(viewer.userId),
        MentorshipRepository.findViewerBranch(viewer.userId),
        InsightService.getSkillGap(viewer, {}),
        Promise.all((skills || []).map((s) => SkillService.canonicalize(s))),
    ]);
    return {
        topic: topic || null,
        requestedSkills,
        gapSkills: gap.missing.slice(0, GAP_SKILLS_CONSIDERED).map((m) => ({ key: m.skill_key, name: m.skill })),
        branch,
        connectedIds,
    };
}

function actionsFor(row, viewerId) {
    const isMentor = viewerId === row.mentor_id;
    const isMentee = viewerId === row.mentee_id;
    if (!isMentor && !isMentee) return [];
    if (row.status === "PENDING") return isMentor ? ["ACCEPT", "REJECT"] : ["CANCEL"];
    if (row.status === "ACTIVE") return ["ADD_GOAL", "LOG_SESSION", "COMPLETE"];
    return [];
}

// What the two participants may see of a mentorship. Each person is public-profile fields only.
function toPublicMentorship(row, viewerId) {
    return {
        id: row.id,
        topic: row.topic,
        status: row.status,
        my_role: viewerId === row.mentor_id ? "mentor" : "mentee",
        message: row.message,
        response: row.response,
        closing_note: row.closing_note,
        created_at: row.created_at,
        started_at: row.started_at,
        ended_at: row.ended_at,
        mentor: {
            user_id: row.mentor_id,
            full_name: row.mentor_name || "SRMS Alumni",
            profile_photo: row.mentor_photo,
            designation: row.mentor_designation,
            company: row.mentor_company,
            is_verified_alumni: row.mentor_role === MENTOR_ROLE,
        },
        mentee: {
            user_id: row.mentee_id,
            full_name: row.mentee_name || "SRMS Student",
            profile_photo: row.mentee_photo,
            branch: row.mentee_branch,
            batch_year: row.mentee_batch_year,
        },
        actions: actionsFor(row, viewerId),
    };
}

const sideOf = (row, userId) => (userId === row.mentor_id ? "mentor" : userId === row.mentee_id ? "mentee" : "system");
const otherPartyOf = (row, userId) => (userId === row.mentor_id ? row.mentee_id : row.mentor_id);

// Only the mentor and the mentee can see or act on a mentorship. Anyone else gets the same 404
// as for one that does not exist, so ids can't be probed.
async function loadForParticipant(viewer, rawId) {
    const id = parseId(rawId, "mentorship id");
    const row = await MentorshipRepository.findMentorshipById(id);
    if (!row || (row.mentor_id !== viewer.userId && row.mentee_id !== viewer.userId)) {
        throw new AppError("Mentorship not found", 404);
    }
    return row;
}

const requireActive = (row) => {
    if (row.status !== "ACTIVE") {
        throw new AppError("This is only possible while the mentorship is active", 409);
    }
};

const notifyOther = (row, actorId, event, text, dedupeKey) =>
    NotificationService.notifyEvent({
        type: "MENTORSHIP_UPDATE",
        recipientId: otherPartyOf(row, actorId),
        actorId,
        referenceId: row.id,
        extra: notifyExtra(event, row.topic, text),
        dedupeKey,
    });

const MentorshipService = {

    // viewer = { userId, role } from the verified session (never from the request body)

    // ---------- mentor profiles ----------

    async getMyMentorProfile(viewer) {
        const row = await MentorshipRepository.findMentorByUserId(viewer.userId);
        const [mentor] = row ? await loadMentors([row]) : [null];
        return { can_be_mentor: viewer.role === MENTOR_ROLE, mentor: mentor ? toPublicMentor(mentor) : null };
    },

    async saveMentorProfile(viewer, data) {
        if (viewer.role !== MENTOR_ROLE) {
            throw new AppError("Only verified alumni can become mentors", 403);
        }
        await MentorshipRepository.upsertMentorProfile(viewer.userId, {
            bio: data.bio,
            availability: data.availability,
            maxActiveMentees: data.max_active_mentees,
            isAccepting: data.is_accepting,
            topics: data.topics,
            areas: data.areas,
        });
        return MentorshipService.getMyMentorProfile(viewer);
    },

    // ---------- discovery ----------

    async listMentors(viewer, query) {
        const { page, limit } = query;
        const filters = {
            excludeUserId: viewer.userId,
            q: query.q,
            topic: query.topic,
            skillKeyGroups: query.skills && query.skills.length
                ? await Promise.all(query.skills.map((skill) => SkillService.equivalentKeys(skill)))
                : undefined,
        };

        const [rows, total] = await Promise.all([
            MentorshipRepository.findMentors(filters, limit, (page - 1) * limit),
            MentorshipRepository.countMentors(filters),
        ]);
        const mentors = await loadMentors(rows);

        return {
            mentors: mentors.map(toPublicMentor),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            can_request: MENTEE_ROLES.includes(viewer.role),
            can_be_mentor: viewer.role === MENTOR_ROLE,
        };
    },

    // Rule-based recommendations for the signed-in user, with the score and the reasons behind it.
    async getMatches(viewer, query = {}) {
        const [rows, context] = await Promise.all([
            MentorshipRepository.findMentors({ excludeUserId: viewer.userId }, MATCH_POOL, 0),
            loadMatchContext(viewer, query),
        ]);
        const ranked = rankMentors(await loadMentors(rows), context);

        return {
            // exactly what was used, so the result can be checked by hand
            criteria: {
                topic: context.topic,
                requested_skills: context.requestedSkills.map((s) => s.name),
                skill_gap_considered: context.gapSkills.map((s) => s.name),
                your_branch: context.branch,
                weights: MATCH_WEIGHTS,
                rule: "Each mentor gets points for every rule they meet. Mentors with a free spot come first, then the highest score.",
            },
            matches: ranked
                .filter((m) => m.match.score > 0)
                .slice(0, MATCH_RESULTS)
                .map((m) => ({ ...toPublicMentor(m), match: m.match })),
            mentors_considered: ranked.length,
            can_request: MENTEE_ROLES.includes(viewer.role),
        };
    },

    // a mentor's page: their published mentor profile, why they match you, and where you stand
    async getMentor(viewer, rawUserId) {
        const userId = parseId(rawUserId, "mentor id");
        const row = await MentorshipRepository.findMentorByUserId(userId);
        if (!row || row.status !== "ACTIVE" || row.role !== MENTOR_ROLE) {
            throw new AppError("Mentor not found", 404);
        }
        const [mentor] = await loadMentors([row]);
        const isSelf = viewer.userId === userId;

        const [context, open] = isSelf
            ? [null, null]
            : await Promise.all([loadMatchContext(viewer), MentorshipRepository.findOpenBetween(userId, viewer.userId)]);

        return {
            mentor: toPublicMentor(mentor),
            match: context ? scoreMentor(mentor, context) : null,
            viewer: {
                is_self: isSelf,
                is_connected: context ? context.connectedIds.has(userId) : false,
                can_request: !isSelf && MENTEE_ROLES.includes(viewer.role),
                open_mentorship: open ? { id: open.id, status: open.status } : null,
            },
        };
    },

    // ---------- the mentorship flow ----------

    async createMentorship(viewer, data) {
        if (!MENTEE_ROLES.includes(viewer.role)) {
            throw new AppError("Only students can request mentorship", 403);
        }
        if (data.mentor_id === viewer.userId) {
            throw new AppError("You can't request mentorship from yourself", 400);
        }

        // must be an ACTIVE alumnus who has published a mentor profile; anything else is "not found"
        const row = await MentorshipRepository.findMentorByUserId(data.mentor_id);
        if (!row || row.status !== "ACTIVE" || row.role !== MENTOR_ROLE) {
            throw new AppError("Mentor not found", 404);
        }
        const [mentor] = await loadMentors([row]);

        if (!mentor.is_accepting) {
            throw new AppError("This mentor is not accepting new mentees right now", 400);
        }
        if (mentor.spots_left === 0) {
            throw new AppError("This mentor has no free spots right now", 400);
        }
        if (!mentor.topics.includes(data.topic)) {
            throw new AppError("This mentor doesn't offer that topic", 400);
        }
        if ((await MentorshipRepository.countPendingByMentee(viewer.userId)) >= LIMITS.MAX_PENDING_PER_MENTEE) {
            throw new AppError(
                `You have ${LIMITS.MAX_PENDING_PER_MENTEE} mentorship requests waiting. Wait for a reply or cancel one first.`,
                400
            );
        }

        let id;
        try {
            id = await MentorshipRepository.createMentorship({
                mentorId: data.mentor_id,
                menteeId: viewer.userId,
                topic: data.topic,
                message: data.message,
                goals: data.goals,
            });
        } catch (error) {
            // the unique "one open mentorship per mentor + student" key (also wins any race)
            if (error.code === "ER_DUP_ENTRY") {
                throw new AppError("You already have an open mentorship or request with this mentor", 409);
            }
            throw error;
        }

        await NotificationService.notifyEvent({
            type: "MENTORSHIP_REQUEST",
            recipientId: data.mentor_id,
            actorId: viewer.userId,
            referenceId: id,
            extra: notifyExtra("PENDING", data.topic, shorten(data.message)),
            dedupeKey: requestKey(id),
        });

        return { id };
    },

    async listMentorships(viewer, query) {
        const { page, limit, box, status } = query;
        const filters = { box, status };
        const [rows, total] = await Promise.all([
            MentorshipRepository.findMentorships(viewer.userId, filters, limit, (page - 1) * limit),
            MentorshipRepository.countMentorships(viewer.userId, filters),
        ]);
        return {
            mentorships: rows.map((r) => toPublicMentorship(r, viewer.userId)),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            can_request: MENTEE_ROLES.includes(viewer.role),
            can_be_mentor: viewer.role === MENTOR_ROLE,
        };
    },

    async getMentorship(viewer, rawId) {
        const row = await loadForParticipant(viewer, rawId);
        const [goals, sessions, events] = await Promise.all([
            MentorshipRepository.findGoals(row.id),
            MentorshipRepository.findSessions(row.id),
            MentorshipRepository.findEvents(row.id),
        ]);

        return {
            ...toPublicMentorship(row, viewer.userId),
            goals: goals.map((g) => ({
                id: g.id,
                title: g.title,
                status: g.status,
                added_by: sideOf(row, g.created_by),
                created_at: g.created_at,
                completed_at: g.completed_at,
            })),
            sessions: sessions.map((s) => ({
                id: s.id,
                session_date: s.session_date,
                duration_minutes: s.duration_minutes,
                notes: s.notes,
                logged_by: sideOf(row, s.created_by),
                created_at: s.created_at,
            })),
            // who did what, relative to the mentorship - never a raw user id
            history: events.map((e) => ({ status: e.to_status, by: sideOf(row, e.actor_id), at: e.created_at })),
        };
    },

    // accept / decline - only the mentor the request was sent to
    async respond(viewer, rawId, { action, response }) {
        const row = await loadForParticipant(viewer, rawId);

        if (row.mentor_id !== viewer.userId) {
            throw new AppError("Only the mentor this request was sent to can respond", 403);
        }
        if (row.status !== "PENDING") {
            throw new AppError(`This request is ${row.status.toLowerCase()} and can't be changed that way`, 409);
        }

        let status;
        if (action === "ACCEPT") {
            if (row.mentee_status !== "ACTIVE") {
                throw new AppError("This request is no longer available", 409);
            }
            const outcome = await MentorshipRepository.acceptMentorship({ id: row.id, mentorId: viewer.userId, response });
            if (outcome === "full") {
                throw new AppError("You have reached your maximum number of active mentees. Complete one or raise your limit first.", 400);
            }
            if (outcome !== "accepted") {
                throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
            }
            status = "ACTIVE";
        } else {
            const changed = await MentorshipRepository.transition({ id: row.id, from: "PENDING", to: "REJECTED", actorId: viewer.userId, response });
            if (!changed) {
                throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
            }
            status = "REJECTED";
        }

        await NotificationService.settleByKey(requestKey(row.id));
        await notifyOther(row, viewer.userId, status, shorten(response), `MENTORSHIP:${row.id}:${status}`);

        return { id: row.id, status };
    },

    // withdraw a request that has not been answered - only the student who made it
    async cancel(viewer, rawId) {
        const row = await loadForParticipant(viewer, rawId);

        if (row.mentee_id !== viewer.userId) {
            throw new AppError("Only the student who made this request can cancel it", 403);
        }
        if (row.status !== "PENDING") {
            throw new AppError(`This request is ${row.status.toLowerCase()} and can't be cancelled`, 409);
        }

        const changed = await MentorshipRepository.transition({ id: row.id, from: "PENDING", to: "CANCELLED", actorId: viewer.userId });
        if (!changed) {
            throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
        }

        // never answered: it simply disappears from the mentor's notifications
        await NotificationService.removeByKey(requestKey(row.id));
        return { id: row.id, status: "CANCELLED" };
    },

    // close an active mentorship - either the mentor or the mentee
    async complete(viewer, rawId, { note } = {}) {
        const row = await loadForParticipant(viewer, rawId);
        requireActive(row);

        const changed = await MentorshipRepository.transition({
            id: row.id,
            from: "ACTIVE",
            to: "COMPLETED",
            actorId: viewer.userId,
            closingNote: note,
            markEnded: true,
        });
        if (!changed) {
            throw new AppError("This mentorship was just updated by someone else. Refresh and try again.", 409);
        }

        await notifyOther(row, viewer.userId, "COMPLETED", shorten(note), `MENTORSHIP:${row.id}:COMPLETED`);
        return { id: row.id, status: "COMPLETED" };
    },

    // ---------- goals and sessions (either participant, while active) ----------

    async addGoal(viewer, rawId, { title }) {
        const row = await loadForParticipant(viewer, rawId);
        requireActive(row);

        if ((await MentorshipRepository.findGoals(row.id)).length >= LIMITS.MAX_GOALS) {
            throw new AppError(`A mentorship can have at most ${LIMITS.MAX_GOALS} goals`, 400);
        }
        const goalId = await MentorshipRepository.createGoal(row.id, title, viewer.userId);

        await notifyOther(row, viewer.userId, "GOAL_ADDED", shorten(title), `MENTORSHIP_GOAL:${goalId}:ADDED`);
        return { id: goalId };
    },

    async setGoalStatus(viewer, rawId, rawGoalId, { status }) {
        const row = await loadForParticipant(viewer, rawId);
        requireActive(row);

        const goalId = parseId(rawGoalId, "goal id");
        // the goal must belong to this mentorship, so a goal id from elsewhere is "not found"
        const goal = await MentorshipRepository.findGoal(goalId, row.id);
        if (!goal) {
            throw new AppError("Goal not found", 404);
        }

        const changed = await MentorshipRepository.setGoalStatus(goalId, row.id, status);
        if (changed && status === "DONE") {
            await notifyOther(row, viewer.userId, "GOAL_DONE", shorten(goal.title), `MENTORSHIP_GOAL:${goalId}:DONE`);
        }
        return { id: goalId, status };
    },

    async addSession(viewer, rawId, data) {
        const row = await loadForParticipant(viewer, rawId);
        requireActive(row);

        if ((await MentorshipRepository.findSessions(row.id)).length >= LIMITS.MAX_SESSIONS) {
            throw new AppError("This mentorship has reached its session log limit", 400);
        }
        const sessionId = await MentorshipRepository.createSession(
            row.id,
            { sessionDate: data.session_date, durationMinutes: data.duration_minutes, notes: data.notes },
            viewer.userId
        );

        await notifyOther(row, viewer.userId, "SESSION", data.session_date, `MENTORSHIP_SESSION:${sessionId}`);
        return { id: sessionId };
    },
};

module.exports = MentorshipService;
module.exports.toPublicMentorship = toPublicMentorship;
module.exports.actionsFor = actionsFor;
