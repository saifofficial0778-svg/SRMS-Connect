const NotificationRepository = require("./notification.repository");
const AppError = require("../../utils/AppError");
const { getIo, userRoom } = require("../../socket/socketRegistry");

const TYPES = {
    CONNECTION_REQUEST: "CONNECTION_REQUEST",
    CONNECTION_ACCEPTED: "CONNECTION_ACCEPTED",
    POST_LIKE: "POST_LIKE",
    POST_COMMENT: "POST_COMMENT",
    NEW_MESSAGE: "NEW_MESSAGE",
    ACCOUNT_STATUS: "ACCOUNT_STATUS",
    JOB_POSTED: "JOB_POSTED",
    CAREER_REQUEST: "CAREER_REQUEST",
    CAREER_UPDATE: "CAREER_UPDATE",
    MENTORSHIP_REQUEST: "MENTORSHIP_REQUEST",
    MENTORSHIP_UPDATE: "MENTORSHIP_UPDATE",
    INTRO_REQUEST: "INTRO_REQUEST",
    INTRO_UPDATE: "INTRO_UPDATE",
    PROFILE_VIEW: "PROFILE_VIEW",
};

// extra for career notifications: "<request type>|<status>|<what it is about>", e.g.
// "REFERRAL|ACCEPTED|Backend Engineer at Acme". The client turns it into a sentence.
const careerExtra = (requestType, status, text) => `${requestType}|${status}|${text || ""}`.slice(0, 255);

const JOB_NOTIFICATION_LIMIT = 200; // most connections one job post can notify

const DEFAULT_LIMIT = 20;
const SNIPPET_LENGTH = 100;

const snippet = (text) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length > SNIPPET_LENGTH ? `${clean.slice(0, SNIPPET_LENGTH - 1)}…` : clean;
};

// What a client may see. Actor details are limited to what the public profile already shows.
function toPublicNotification(row) {
    return {
        id: row.id,
        type: row.type,
        reference_id: row.reference_id,
        extra: row.extra,
        is_read: Boolean(row.is_read),
        created_at: row.created_at,
        actor: row.actor_id
            ? { user_id: row.actor_id, full_name: row.actor_name, profile_photo: row.actor_photo }
            : null,
    };
}

const emitToUser = (userId, event, payload) => {
    const io = getIo();
    if (io) io.to(userRoom(userId)).emit(event, payload);
};

// Tells every open tab of the user that some notifications were read/removed.
async function emitReadSync(userId, extra = {}) {
    const unreadCount = await NotificationRepository.countByRecipient(userId, { unreadOnly: true });
    emitToUser(userId, "notifications_read", { ...extra, unreadCount });
}

// Pushes a freshly created/updated notification to the recipient's sockets.
async function pushNotification(recipientId, notificationId) {
    const row = await NotificationRepository.findVisibleById(notificationId, recipientId);
    if (!row) return; // hidden (e.g. actor not active) - nothing to show
    const unreadCount = await NotificationRepository.countByRecipient(recipientId, { unreadOnly: true });
    emitToUser(recipientId, "notification", { notification: toPublicNotification(row), unreadCount });
}

// Notifications are a side effect of other actions: they must never make those actions fail,
// and a user is never notified about their own actions.
async function safely(label, fn) {
    try {
        await fn();
    } catch (error) {
        console.error(`[notification] ${label} failed:`, error.message);
    }
}

async function create({ recipientId, actorId, type, referenceId, extra, dedupeKey, bump = false }) {
    recipientId = Number(recipientId);
    actorId = actorId == null ? null : Number(actorId);
    if (!recipientId || recipientId === actorId) return null;

    let id = await NotificationRepository.insertIfNew({ recipientId, actorId, type, referenceId, extra, dedupeKey });
    if (!id && bump) {
        id = await NotificationRepository.bumpByDedupeKey({ recipientId, actorId, extra, dedupeKey });
    }
    if (!id) return null; // duplicate of something already sent, or recipient not active

    await pushNotification(recipientId, id);
    return id;
}

const NotificationService = {

    // ---------- called by other modules when something happens ----------

    notifyConnectionRequest({ senderId, receiverId, connectionId }) {
        return safely("connection request", () =>
            create({
                recipientId: receiverId,
                actorId: senderId,
                type: TYPES.CONNECTION_REQUEST,
                referenceId: connectionId,
                dedupeKey: `CONNECTION_REQUEST:${connectionId}`,
            })
        );
    },

    notifyConnectionAccepted({ accepterId, senderId, connectionId }) {
        return safely("connection accepted", () =>
            create({
                recipientId: senderId,
                actorId: accepterId,
                type: TYPES.CONNECTION_ACCEPTED,
                referenceId: connectionId,
                dedupeKey: `CONNECTION_ACCEPTED:${connectionId}`,
            })
        );
    },

    // like -> unlike -> like again never produces a second notification (same dedupe key)
    notifyPostLike({ postOwnerId, actorId, postId }) {
        return safely("post like", () =>
            create({
                recipientId: postOwnerId,
                actorId,
                type: TYPES.POST_LIKE,
                referenceId: postId,
                dedupeKey: `POST_LIKE:${postId}:${actorId}`,
            })
        );
    },

    notifyPostComment({ postOwnerId, actorId, postId, commentId, content }) {
        return safely("post comment", () =>
            create({
                recipientId: postOwnerId,
                actorId,
                type: TYPES.POST_COMMENT,
                referenceId: postId,
                extra: snippet(content),
                dedupeKey: `POST_COMMENT:${commentId}`,
            })
        );
    },

    // one notification per conversation: later messages refresh it (and make it unread again)
    notifyNewMessage({ receiverId, senderId, conversationId, content }) {
        return safely("new message", () =>
            create({
                recipientId: receiverId,
                actorId: senderId,
                type: TYPES.NEW_MESSAGE,
                referenceId: conversationId,
                extra: snippet(content),
                dedupeKey: `NEW_MESSAGE:${conversationId}`,
                bump: true,
            })
        );
    },

    // A new job is announced to the poster's own connections only (never broadcast to everyone).
    notifyJobPosted({ posterId, jobId, title, company }) {
        return safely("job posted", async () => {
            const dedupeKey = `JOB_POSTED:${jobId}`;
            const created = await NotificationRepository.insertForConnections({
                actorId: Number(posterId),
                type: TYPES.JOB_POSTED,
                referenceId: jobId,
                extra: snippet(`${title} at ${company}`),
                dedupeKey,
                limit: JOB_NOTIFICATION_LIMIT,
            });
            if (!created) return;

            for (const { id, recipient_id: recipientId } of await NotificationRepository.findByDedupeKey(dedupeKey)) {
                await pushNotification(recipientId, id);
            }
        });
    },

    // Generic entry point for modules whose notifications all share one shape (mentorship, warm
    // introductions): the caller names the type, the recipient, what it points at and a dedupe key.
    // Same guarantees as every other notification: never to yourself, never twice for one key,
    // only to ACTIVE recipients, and a failure never breaks the caller.
    notifyEvent({ type, recipientId, actorId, referenceId, extra, dedupeKey }) {
        return safely(`${type} notification`, () =>
            create({ recipientId, actorId, type, referenceId, extra: extra == null ? null : String(extra).slice(0, 255), dedupeKey })
        );
    },

    // the recipient has dealt with whatever this notification asked for
    settleByKey(dedupeKey) {
        return safely("settle notification", async () => {
            await NotificationRepository.markReadByDedupeKey(dedupeKey);
        });
    },

    // the thing it pointed at was withdrawn: the notification goes away
    removeByKey(dedupeKey) {
        return safely("remove notification", async () => {
            const recipients = await NotificationRepository.deleteByDedupeKey(dedupeKey);
            for (const id of recipients) await emitReadSync(id, { removed: true });
        });
    },

    // a student asked this alumnus for a referral / resume review / answer
    notifyCareerRequest({ requestId, requesterId, alumniId, requestType, text }) {
        return safely("career request", () =>
            create({
                recipientId: alumniId,
                actorId: requesterId,
                type: TYPES.CAREER_REQUEST,
                referenceId: requestId,
                extra: careerExtra(requestType, "PENDING", text),
                dedupeKey: `CAREER:${requestId}:PENDING`,
            })
        );
    },

    // a request changed status (accepted / rejected / answered / completed / cancelled).
    // One notification per request + status, so a repeated call can never notify twice.
    notifyCareerUpdate({ requestId, recipientId, actorId, requestType, status, text }) {
        return safely("career update", () =>
            create({
                recipientId,
                actorId,
                type: TYPES.CAREER_UPDATE,
                referenceId: requestId,
                extra: careerExtra(requestType, status, text),
                dedupeKey: `CAREER:${requestId}:${status}`,
            })
        );
    },

    // admin approved a pending account (APPROVED) or lifted a block (REINSTATED).
    // Only these are created: a blocked/rejected user can't sign in to see a notification.
    notifyAccountActivated({ userId, previousStatus }) {
        return safely("account status", () =>
            create({
                recipientId: userId,
                actorId: null, // shown as "SRMS", the admin's identity is not exposed
                type: TYPES.ACCOUNT_STATUS,
                extra: previousStatus === "PENDING" ? "APPROVED" : "REINSTATED",
                dedupeKey: `ACCOUNT_STATUS:${Date.now()}`,
            })
        );
    },

    // ---------- keeping notifications in step with what they point at ----------

    // request accepted/rejected: the recipient has dealt with it
    markConnectionRequestHandled(connectionId) {
        return safely("resolve connection request", async () => {
            await NotificationRepository.markReadByDedupeKey(`CONNECTION_REQUEST:${connectionId}`);
        });
    },

    // sender cancelled: the request no longer exists, so neither should its notification
    removeConnectionRequest(connectionId) {
        return safely("remove connection request", async () => {
            const recipients = await NotificationRepository.deleteByDedupeKey(`CONNECTION_REQUEST:${connectionId}`);
            for (const id of recipients) await emitReadSync(id, { removed: true });
        });
    },

    removePostNotifications(postId) {
        return safely("remove post notifications", async () => {
            const recipients = await NotificationRepository.deleteByReference(
                [TYPES.POST_LIKE, TYPES.POST_COMMENT],
                postId
            );
            for (const id of recipients) await emitReadSync(id, { removed: true });
        });
    },

    // job deleted: its announcements go away with it
    removeJobNotifications(jobId) {
        return safely("remove job notifications", async () => {
            const recipients = await NotificationRepository.deleteByReference([TYPES.JOB_POSTED], jobId);
            for (const id of recipients) await emitReadSync(id, { removed: true });
        });
    },

    // the alumnus responded: their "new request" notification is done
    markCareerRequestHandled(requestId) {
        return safely("resolve career request", async () => {
            await NotificationRepository.markReadByDedupeKey(`CAREER:${requestId}:PENDING`);
        });
    },

    // the student withdrew before any reply: the request notification goes away
    removeCareerRequestNotification(requestId) {
        return safely("remove career request", async () => {
            const recipients = await NotificationRepository.deleteByDedupeKey(`CAREER:${requestId}:PENDING`);
            for (const id of recipients) await emitReadSync(id, { removed: true });
        });
    },

    removeCommentNotification(commentId) {
        return safely("remove comment notification", async () => {
            const recipients = await NotificationRepository.deleteByDedupeKey(`POST_COMMENT:${commentId}`);
            for (const id of recipients) await emitReadSync(id, { removed: true });
        });
    },

    // the user opened the conversation: its "new message" notification is read
    markMessageNotificationsRead(userId, conversationId) {
        return safely("read message notifications", async () => {
            const changed = await NotificationRepository.markReadByReference(
                userId,
                TYPES.NEW_MESSAGE,
                conversationId
            );
            if (changed) {
                await emitReadSync(userId, { type: TYPES.NEW_MESSAGE, referenceId: Number(conversationId) });
            }
        });
    },

    // ---------- what the notification API exposes (always scoped to the signed-in user) ----------

    async list(userId, { page = 1, limit = DEFAULT_LIMIT, unreadOnly = false } = {}) {
        const offset = (page - 1) * limit;
        const [rows, total, unreadCount] = await Promise.all([
            NotificationRepository.findByRecipient(userId, { limit, offset, unreadOnly }),
            NotificationRepository.countByRecipient(userId, { unreadOnly }),
            NotificationRepository.countByRecipient(userId, { unreadOnly: true }),
        ]);

        return {
            notifications: rows.map(toPublicNotification),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
            unreadCount,
        };
    },

    async getUnreadCount(userId) {
        return { count: await NotificationRepository.countByRecipient(userId, { unreadOnly: true }) };
    },

    async markRead(userId, notificationId) {
        const id = Number(notificationId);
        if (!Number.isInteger(id) || id < 1) {
            throw new AppError("Invalid notification id", 400);
        }

        // someone else's notification looks exactly like one that doesn't exist
        const owned = await NotificationRepository.existsForRecipient(id, userId);
        if (!owned) {
            throw new AppError("Notification not found", 404);
        }

        await NotificationRepository.markRead(id, userId);
        const unreadCount = await NotificationRepository.countByRecipient(userId, { unreadOnly: true });
        emitToUser(userId, "notifications_read", { ids: [id], unreadCount });
        return { unreadCount };
    },

    async markAllRead(userId) {
        const updated = await NotificationRepository.markAllRead(userId);
        emitToUser(userId, "notifications_read", { all: true, unreadCount: 0 });
        return { updated, unreadCount: 0 };
    },
};

module.exports = NotificationService;
module.exports.toPublicNotification = toPublicNotification;
module.exports.TYPES = TYPES;
