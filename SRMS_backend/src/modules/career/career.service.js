const CareerRepository = require("./career.repository");
const ConnectionRepository = require("../connection/connection.repository");
const JobRepository = require("../job/job.repository");
const NotificationService = require("../notification/notification.service");
const AppError = require("../../utils/AppError");
const {
    REQUESTER_ROLES,
    RESPONDER_ROLE,
    RESPOND_ACTIONS,
    CANCELLABLE_FROM,
    OPEN_TO_FOR_TYPE,
    MAX_PENDING_PER_REQUESTER,
} = require("./career.constants");

const TYPE_LABELS = { REFERRAL: "referral", RESUME_REVIEW: "resume review", QUESTION: "question" };

const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw new AppError("Invalid request id", 400);
    }
    return id;
};

const shorten = (text, max = 90) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

// what the request is "about", for notifications: the job for referrals, a snippet otherwise
const subjectOf = (row) => (row.job_title ? `${row.job_title} at ${row.job_company}` : shorten(row.message));

// The actions the viewer may take on this request right now. The UI renders its buttons from
// this list; the same rules are enforced again when an action is actually attempted.
function actionsFor(row, viewerId) {
    if (viewerId === row.alumni_id) {
        return Object.entries(RESPOND_ACTIONS[row.type])
            .filter(([, rule]) => rule.from === row.status)
            .map(([action]) => action);
    }
    if (viewerId === row.requester_id && CANCELLABLE_FROM[row.type].includes(row.status)) {
        return ["CANCEL"];
    }
    return [];
}

// What a participant may see. Each person is described only by public profile fields; the
// message, resume link and response are visible to the two participants and nobody else.
function toPublicRequest(row, viewerId) {
    return {
        id: row.id,
        type: row.type,
        status: row.status,
        direction: viewerId === row.requester_id ? "sent" : "received",
        message: row.message,
        resume_url: row.resume_url,
        response: row.response,
        created_at: row.created_at,
        updated_at: row.updated_at,
        responded_at: row.responded_at,
        requester: {
            user_id: row.requester_id,
            full_name: row.requester_name || "SRMS Student",
            profile_photo: row.requester_photo,
            designation: row.requester_designation,
            company: row.requester_company,
            branch: row.requester_branch,
            batch_year: row.requester_batch_year,
            role: row.requester_role,
        },
        alumni: {
            user_id: row.alumni_id,
            full_name: row.alumni_name || "SRMS Alumni",
            profile_photo: row.alumni_photo,
            designation: row.alumni_designation,
            company: row.alumni_company,
            is_verified_alumni: row.alumni_role === "ALUMNI",
        },
        job: row.job_id
            ? { id: row.job_id, title: row.job_title, company: row.job_company, location: row.job_location, status: row.job_status }
            : null,
        actions: actionsFor(row, viewerId),
    };
}

// Only the two people in a request can see or act on it. Anyone else gets the same 404 as for a
// request that does not exist, so ids can't be probed.
async function loadForParticipant(viewer, rawId) {
    const id = parseId(rawId);
    const row = await CareerRepository.findRequestById(id);
    if (!row || (row.requester_id !== viewer.userId && row.alumni_id !== viewer.userId)) {
        throw new AppError("Request not found", 404);
    }
    return row;
}

const isAccepted = (connection) => Boolean(connection) && connection.status === "ACCEPTED";

const CareerService = {

    // viewer = { userId, role } from the verified session (never from the request body)

    // Alumni the viewer can ask: their own accepted connections who are ACTIVE alumni.
    async listEligibleAlumni(viewer, { type, job_id: jobId }) {
        let job = null;
        if (type === "REFERRAL") {
            job = await CareerService._loadOpenJob(jobId);
        }

        const rows = await CareerRepository.findEligibleAlumni(viewer.userId, {
            type,
            intent: OPEN_TO_FOR_TYPE[type],
            jobId: job ? job.id : null,
            jobPosterId: job ? job.poster_id : null,
            jobCompany: job ? job.company : null,
        });

        return {
            can_request: REQUESTER_ROLES.includes(viewer.role),
            job: job ? { id: job.id, title: job.title, company: job.company, location: job.location } : null,
            alumni: rows.map((r) => ({
                user_id: r.user_id,
                full_name: r.full_name || "SRMS Alumni",
                profile_photo: r.profile_photo,
                designation: r.designation,
                company: r.company,
                is_verified_alumni: true,
                is_job_poster: Boolean(r.is_job_poster),
                same_company: Boolean(r.same_company),
                is_open_to: Boolean(r.is_open_to),
                has_active_request: Boolean(r.has_active_request),
            })),
        };
    },

    // a referral can only be requested for a job that is open and visible
    async _loadOpenJob(jobId) {
        const job = await JobRepository.findJobById(jobId);
        if (!job || job.status === "DELETED" || job.poster_status !== "ACTIVE" || job.poster_role !== "ALUMNI") {
            throw new AppError("Job not found", 404);
        }
        if (job.status !== "OPEN") {
            throw new AppError("This job is closed and no longer accepting referrals", 400);
        }
        return job;
    },

    async createRequest(viewer, data) {
        const { type, alumni_id: alumniId } = data;

        if (!REQUESTER_ROLES.includes(viewer.role)) {
            throw new AppError("Only students can request career help", 403);
        }
        if (alumniId === viewer.userId) {
            throw new AppError("You can't send a request to yourself", 400);
        }

        // the person asked must be an ACTIVE alumnus; anything else looks like "not found"
        const target = await CareerRepository.findUserBrief(alumniId);
        if (!target || target.status !== "ACTIVE" || target.role !== RESPONDER_ROLE) {
            throw new AppError("Alumni not found", 404);
        }

        // Referrals and resume reviews need an ACCEPTED connection. A question may also go to an
        // alumnus who has opted in to mentorship on their profile, connected or not.
        const connected = isAccepted(await ConnectionRepository.findConnection(viewer.userId, alumniId));
        if (!connected) {
            const optedIn = type === "QUESTION" && (await CareerRepository.hasOpenTo(alumniId, OPEN_TO_FOR_TYPE.QUESTION));
            if (!optedIn) {
                throw new AppError(
                    type === "QUESTION"
                        ? "You can ask alumni you are connected with, or who are open to mentorship"
                        : "You can only request this from alumni you are connected with",
                    403
                );
            }
        }

        const job = type === "REFERRAL" ? await CareerService._loadOpenJob(data.job_id) : null;

        if ((await CareerRepository.countPendingByRequester(viewer.userId)) >= MAX_PENDING_PER_REQUESTER) {
            throw new AppError(
                `You have ${MAX_PENDING_PER_REQUESTER} requests waiting for a reply. Wait for a response or cancel one first.`,
                400
            );
        }

        let id;
        try {
            id = await CareerRepository.createRequest({
                type,
                requesterId: viewer.userId,
                alumniId,
                jobId: job ? job.id : null,
                message: data.message,
                resumeUrl: data.resume_url,
            });
        } catch (error) {
            // the unique "one active request" key (also wins any race between two submissions)
            if (error.code === "ER_DUP_ENTRY") {
                throw new AppError(`You already have an active ${TYPE_LABELS[type]} request with this alumnus`, 409);
            }
            throw error;
        }

        await NotificationService.notifyCareerRequest({
            requestId: id,
            requesterId: viewer.userId,
            alumniId,
            requestType: type,
            text: job ? `${job.title} at ${job.company}` : shorten(data.message),
        });

        return { id };
    },

    async listRequests(viewer, query) {
        const { page, limit, box, type, status } = query;
        const filters = { box, type, status };

        const [rows, total] = await Promise.all([
            CareerRepository.findRequests(viewer.userId, filters, limit, (page - 1) * limit),
            CareerRepository.countRequests(viewer.userId, filters),
        ]);

        return {
            requests: rows.map((r) => toPublicRequest(r, viewer.userId)),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            // lets the UI show the right dashboard without guessing roles on the client
            can_request: REQUESTER_ROLES.includes(viewer.role),
            can_respond: viewer.role === RESPONDER_ROLE,
        };
    },

    async getRequest(viewer, rawId) {
        const row = await loadForParticipant(viewer, rawId);
        const events = await CareerRepository.findEvents(row.id);

        return {
            ...toPublicRequest(row, viewer.userId),
            history: events.map((e) => ({
                status: e.to_status,
                // who did it, relative to the request - never another user's id
                by: e.actor_id === row.requester_id ? "requester" : e.actor_id === row.alumni_id ? "alumni" : "system",
                note: e.note,
                at: e.created_at,
            })),
        };
    },

    // accept / reject / answer / complete - only the alumnus the request was sent to
    async respond(viewer, rawId, { action, response }) {
        const row = await loadForParticipant(viewer, rawId);

        if (row.alumni_id !== viewer.userId) {
            throw new AppError("Only the alumnus this request was sent to can respond", 403);
        }

        const rule = RESPOND_ACTIONS[row.type][action];
        if (!rule) {
            throw new AppError(`A ${TYPE_LABELS[row.type]} request can't be ${action.toLowerCase()}ed`, 400);
        }
        if (row.status !== rule.from) {
            throw new AppError(`This request is ${row.status.toLowerCase()} and can't be changed that way`, 409);
        }
        if (rule.responseRequired && (!response || response.length < 10)) {
            throw new AppError("Please write an answer of at least 10 characters", 400);
        }

        // saying yes (or answering) requires the student to still be an ACTIVE account, and for
        // referrals / resume reviews the two must still be connected; declining is always allowed
        if (action !== "REJECT") {
            if (row.requester_status !== "ACTIVE") {
                throw new AppError("This request is no longer available", 409);
            }
            if (row.type !== "QUESTION") {
                const connection = await ConnectionRepository.findConnection(row.requester_id, row.alumni_id);
                if (!isAccepted(connection)) {
                    throw new AppError("You are no longer connected with this student", 409);
                }
            }
        }

        const changed = await CareerRepository.transition({
            id: row.id,
            from: rule.from,
            to: rule.to,
            actorId: viewer.userId,
            response,
            markResponded: true,
        });
        if (!changed) {
            throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
        }

        // the alumnus has dealt with it: their "new request" notification is settled,
        // and the student is told what happened
        await NotificationService.markCareerRequestHandled(row.id);
        await NotificationService.notifyCareerUpdate({
            requestId: row.id,
            recipientId: row.requester_id,
            actorId: viewer.userId,
            requestType: row.type,
            status: rule.to,
            text: subjectOf(row),
        });

        return { id: row.id, status: rule.to };
    },

    // withdraw - only the student who made the request
    async cancel(viewer, rawId) {
        const row = await loadForParticipant(viewer, rawId);

        if (row.requester_id !== viewer.userId) {
            throw new AppError("Only the person who made this request can cancel it", 403);
        }
        if (!CANCELLABLE_FROM[row.type].includes(row.status)) {
            throw new AppError(`This request is ${row.status.toLowerCase()} and can't be cancelled`, 409);
        }

        const changed = await CareerRepository.transition({
            id: row.id,
            from: row.status,
            to: "CANCELLED",
            actorId: viewer.userId,
        });
        if (!changed) {
            throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
        }

        if (row.status === "PENDING") {
            // never answered: the request simply disappears from the alumnus's notifications
            await NotificationService.removeCareerRequestNotification(row.id);
        } else {
            // the alumnus had already agreed, so they should know it was withdrawn
            await NotificationService.notifyCareerUpdate({
                requestId: row.id,
                recipientId: row.alumni_id,
                actorId: viewer.userId,
                requestType: row.type,
                status: "CANCELLED",
                text: subjectOf(row),
            });
        }

        return { id: row.id, status: "CANCELLED" };
    },

    // called by the jobs module when a job is deleted
    async closeRequestsForDeletedJob(jobId, job = {}) {
        const rows = await CareerRepository.cancelActiveForJob(jobId);
        for (const row of rows) {
            await NotificationService.removeCareerRequestNotification(row.id);
            await NotificationService.notifyCareerUpdate({
                requestId: row.id,
                recipientId: row.requester_id,
                actorId: null, // system notice
                requestType: "REFERRAL",
                status: "CANCELLED",
                text: job.title ? `${job.title} at ${job.company} was removed` : "The job was removed",
            });
        }
        return rows.length;
    },
};

module.exports = CareerService;
module.exports.toPublicRequest = toPublicRequest;
module.exports.actionsFor = actionsFor;
