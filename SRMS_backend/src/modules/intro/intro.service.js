const IntroRepository = require("./intro.repository");
const ConnectionRepository = require("../connection/connection.repository");
const NotificationService = require("../notification/notification.service");
const AppError = require("../../utils/AppError");

// Who may ask for an introduction, and who may be reached / may introduce.
const REQUESTER_ROLES = ["STUDENT"];
const ALUMNI = "ALUMNI";
const MAX_PENDING_PER_REQUESTER = 5;

const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw new AppError("Invalid introduction id", 400);
    }
    return id;
};

const isAccepted = (connection) => Boolean(connection) && connection.status === "ACCEPTED";
const isActiveAlumnus = (user) => Boolean(user) && user.status === "ACTIVE" && user.role === ALUMNI;
const requestKey = (id) => `INTRO:${id}:PENDING`;

const publicPerson = (row, prefix, extra = {}) => ({
    user_id: row[`${prefix}_id`],
    full_name: row[`${prefix}_name`] || "SRMS member",
    profile_photo: row[`${prefix}_photo`],
    designation: row[`${prefix}_designation`],
    company: row[`${prefix}_company`],
    ...extra,
});

const roleIn = (row, userId) =>
    userId === row.requester_id ? "requester" : userId === row.introducer_id ? "introducer" : userId === row.target_id ? "target" : null;

function actionsFor(row, viewerId) {
    if (row.status !== "PENDING") return [];
    if (viewerId === row.introducer_id) return ["INTRODUCE", "DECLINE"];
    if (viewerId === row.requester_id) return ["CANCEL"];
    return [];
}

// What a participant may see. Each person is public-profile fields only.
function toPublicIntro(row, viewerId) {
    return {
        id: row.id,
        status: row.status,
        my_role: roleIn(row, viewerId),
        message: row.message,
        introducer_note: row.introducer_note,
        created_at: row.created_at,
        responded_at: row.responded_at,
        requester: publicPerson(row, "requester", { branch: row.requester_branch, batch_year: row.requester_batch_year }),
        target: publicPerson(row, "target", { is_verified_alumni: row.target_role === ALUMNI }),
        introducer: publicPerson(row, "introducer", { is_verified_alumni: row.introducer_role === ALUMNI }),
        actions: actionsFor(row, viewerId),
    };
}

// The student and the introducer can always see a request. The person being approached can see it
// only once the introduction has actually been made - before that (or if it is declined or
// cancelled) it does not exist for them. Everyone else gets the same 404.
async function loadVisible(viewer, rawId) {
    const id = parseId(rawId);
    const row = await IntroRepository.findIntroById(id);
    const role = row ? roleIn(row, viewer.userId) : null;
    if (!role || (role === "target" && row.status !== "INTRODUCED")) {
        throw new AppError("Introduction not found", 404);
    }
    return row;
}

const IntroService = {

    // viewer = { userId, role } from the verified session (never from the request body)

    // Is there someone who could introduce the viewer to this alumnus?
    async getPaths(viewer, { target_id: targetId }) {
        if (targetId === viewer.userId) {
            throw new AppError("You can't be introduced to yourself", 400);
        }
        const target = await IntroRepository.findUserBrief(targetId);
        if (!isActiveAlumnus(target)) {
            throw new AppError("Alumni not found", 404);
        }

        const [connection, introducers, existing] = await Promise.all([
            ConnectionRepository.findConnection(viewer.userId, targetId),
            IntroRepository.findMutualAlumni(viewer.userId, targetId),
            IntroRepository.findOpenIntro(viewer.userId, targetId),
        ]);

        return {
            target: {
                user_id: target.id,
                full_name: target.full_name || "SRMS Alumni",
                profile_photo: target.profile_photo,
                designation: target.designation,
                company: target.company,
                is_verified_alumni: true,
            },
            // an introduction only makes sense when you are not connected yet
            already_connected: isAccepted(connection),
            can_request: REQUESTER_ROLES.includes(viewer.role),
            existing: existing ? { id: existing.id, status: existing.status } : null,
            introducers: introducers.map((p) => ({
                user_id: p.user_id,
                full_name: p.full_name || "SRMS Alumni",
                profile_photo: p.profile_photo,
                designation: p.designation,
                company: p.company,
                is_verified_alumni: true,
            })),
        };
    },

    async createIntro(viewer, { target_id: targetId, introducer_id: introducerId, message }) {
        if (!REQUESTER_ROLES.includes(viewer.role)) {
            throw new AppError("Only students can ask for an introduction", 403);
        }
        if (targetId === viewer.userId || introducerId === viewer.userId) {
            throw new AppError("You can't be the person introduced to, or the introducer", 400);
        }

        const [target, introducer] = await Promise.all([
            IntroRepository.findUserBrief(targetId),
            IntroRepository.findUserBrief(introducerId),
        ]);
        if (!isActiveAlumnus(target)) {
            throw new AppError("Alumni not found", 404);
        }
        if (!isActiveAlumnus(introducer)) {
            throw new AppError("Introducer not found", 404);
        }

        // the introducer must really know both people: an ACCEPTED connection with each
        const [withTarget, mineWithIntroducer, theirsWithTarget] = await Promise.all([
            ConnectionRepository.findConnection(viewer.userId, targetId),
            ConnectionRepository.findConnection(viewer.userId, introducerId),
            ConnectionRepository.findConnection(introducerId, targetId),
        ]);
        if (isAccepted(withTarget)) {
            throw new AppError("You are already connected with this person", 400);
        }
        if (!isAccepted(mineWithIntroducer) || !isAccepted(theirsWithTarget)) {
            throw new AppError("The introducer must be connected with both you and the person you want to reach", 403);
        }

        const existing = await IntroRepository.findOpenIntro(viewer.userId, targetId);
        if (existing && existing.status === "INTRODUCED") {
            throw new AppError("You have already been introduced to this person", 409);
        }
        if ((await IntroRepository.countPendingByRequester(viewer.userId)) >= MAX_PENDING_PER_REQUESTER) {
            throw new AppError(
                `You have ${MAX_PENDING_PER_REQUESTER} introduction requests waiting. Wait for a reply or cancel one first.`,
                400
            );
        }

        let id;
        try {
            id = await IntroRepository.createIntro({ requesterId: viewer.userId, targetId, introducerId, message });
        } catch (error) {
            // the unique "one pending request per student + target" key (also wins any race)
            if (error.code === "ER_DUP_ENTRY") {
                throw new AppError("You already have a pending introduction request for this person", 409);
            }
            throw error;
        }

        // only the introducer is told. The person being approached hears nothing unless the
        // introducer decides to make the introduction.
        await NotificationService.notifyEvent({
            type: "INTRO_REQUEST",
            recipientId: introducerId,
            actorId: viewer.userId,
            referenceId: id,
            extra: `PENDING|${target.full_name || "an alumnus"}`,
            dedupeKey: requestKey(id),
        });

        return { id };
    },

    async listIntros(viewer, { box, page, limit }) {
        const [rows, total] = await Promise.all([
            IntroRepository.findIntros(viewer.userId, box, limit, (page - 1) * limit),
            IntroRepository.countIntros(viewer.userId, box),
        ]);
        return {
            intros: rows.map((r) => toPublicIntro(r, viewer.userId)),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            can_request: REQUESTER_ROLES.includes(viewer.role),
            can_introduce: viewer.role === ALUMNI,
        };
    },

    async getIntro(viewer, rawId) {
        const row = await loadVisible(viewer, rawId);
        return toPublicIntro(row, viewer.userId);
    },

    // make the introduction, or decline - only the alumnus who was asked
    async respond(viewer, rawId, { action, note }) {
        const row = await loadVisible(viewer, rawId);

        if (row.introducer_id !== viewer.userId) {
            throw new AppError("Only the person asked to make this introduction can respond", 403);
        }
        if (row.status !== "PENDING") {
            throw new AppError(`This request is ${row.status.toLowerCase()} and can't be changed`, 409);
        }

        if (action === "INTRODUCE") {
            // both people must still be ACTIVE accounts the introducer is connected with
            if (row.requester_status !== "ACTIVE" || row.target_status !== "ACTIVE") {
                throw new AppError("This introduction is no longer possible", 409);
            }
            const [withRequester, withTarget] = await Promise.all([
                ConnectionRepository.findConnection(viewer.userId, row.requester_id),
                ConnectionRepository.findConnection(viewer.userId, row.target_id),
            ]);
            if (!isAccepted(withRequester) || !isAccepted(withTarget)) {
                throw new AppError("You are no longer connected with both people", 409);
            }
        }

        const to = action === "INTRODUCE" ? "INTRODUCED" : "DECLINED";
        const changed = await IntroRepository.resolve({ id: row.id, to, note });
        if (!changed) {
            throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
        }

        await NotificationService.settleByKey(requestKey(row.id));

        // the student always learns the outcome
        await NotificationService.notifyEvent({
            type: "INTRO_UPDATE",
            recipientId: row.requester_id,
            actorId: viewer.userId,
            referenceId: row.id,
            extra: `${to}|${row.target_name || "an alumnus"}`,
            dedupeKey: `INTRO:${row.id}:${to}`,
        });

        // The person being approached is told only now, and only because the introducer chose to.
        // Nothing else happens automatically: no connection and no message is created for anyone.
        if (to === "INTRODUCED") {
            await NotificationService.notifyEvent({
                type: "INTRO_UPDATE",
                recipientId: row.target_id,
                actorId: viewer.userId,
                referenceId: row.id,
                extra: `INTRODUCED_TO_YOU|${row.requester_name || "a student"}`,
                dedupeKey: `INTRO:${row.id}:INTRODUCED`,
            });
        }

        return { id: row.id, status: to };
    },

    // withdraw a request that has not been answered - only the student who made it
    async cancel(viewer, rawId) {
        const row = await loadVisible(viewer, rawId);

        if (row.requester_id !== viewer.userId) {
            throw new AppError("Only the person who asked for this introduction can cancel it", 403);
        }
        if (row.status !== "PENDING") {
            throw new AppError(`This request is ${row.status.toLowerCase()} and can't be cancelled`, 409);
        }

        const changed = await IntroRepository.resolve({ id: row.id, to: "CANCELLED" });
        if (!changed) {
            throw new AppError("This request was just updated by someone else. Refresh and try again.", 409);
        }

        await NotificationService.removeByKey(requestKey(row.id));
        return { id: row.id, status: "CANCELLED" };
    },
};

module.exports = IntroService;
module.exports.toPublicIntro = toPublicIntro;
module.exports.actionsFor = actionsFor;
