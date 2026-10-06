const AuthService = require("../modules/auth/auth.service");
const ConversationService = require("../modules/chat/chat.service");
const { setIo, userRoom } = require("./socketRegistry");

// userId -> Set of socket ids. A user can have several tabs open; they count as online until
// the last one closes, and everything addressed to the user goes to all of them (via their room).
const onlineUsers = new Map();

const setupSocket = (io) => {

    // lets REST services (e.g. notifications) push events to a user's sockets
    setIo(io);

    // Socket JWT authentication
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth && socket.handshake.auth.token;

            if (!token) {
                return next(new Error("Authentication token required"));
            }

            // same checks as the HTTP middleware: JWT signature, live session, ACTIVE user
            const { userId, role } = await AuthService.authenticateToken(token);

            socket.user = { userId, role };
            socket.token = token;

            next();
        } catch (error) {
            next(new Error("Invalid token"));
        }
    });

    // Re-checks the session before state-changing events so a logout, expiry or admin
    // block takes effect on an already-open socket, not only on the next handshake.
    const ensureSession = async (socket) => {
        try {
            await AuthService.authenticateToken(socket.token);
            return true;
        } catch (error) {
            socket.emit("auth_error", { message: "Session expired. Please log in again." });
            socket.disconnect(true);
            return false;
        }
    };

    const emitToUser = (targetUserId, event, payload) => {
        if (onlineUsers.has(Number(targetUserId))) {
            io.to(userRoom(targetUserId)).emit(event, payload);
        }
    };

    // Connection
    io.on("connection", (socket) => {

        const userId = socket.user.userId;

        socket.join(userRoom(userId));

        const wasOnline = onlineUsers.has(userId);
        if (!wasOnline) onlineUsers.set(userId, new Set());
        onlineUsers.get(userId).add(socket.id);

        console.log(`User ${userId} connected`);

        // let the newly-connected client know who else is online right now
        socket.emit("online_users", Array.from(onlineUsers.keys()));

        // a page that mounts after the socket is already connected missed the event above
        socket.on("get_online_users", () => {
            socket.emit("online_users", Array.from(onlineUsers.keys()));
        });

        // tell everyone else this user just came online (only for their first tab)
        if (!wasOnline) {
            socket.broadcast.emit("user_online", { userId });
        }

        // Send message
        socket.on("send_message", async (data) => {
            if (!(await ensureSession(socket))) return;
            try {
                const { conversationId, content } = data;

                const result = await ConversationService.sendMessage(
                    conversationId,
                    userId,
                    content
                );

                const payload = {
                    conversationId,
                    messageId: result.messageId,
                    senderId: userId,
                    content: content.trim(),
                    createdAt: result.createdAt,
                };

                // Sender confirmation
                socket.emit("message_sent", payload);

                // Receiver gets message instantly (on every tab they have open)
                emitToUser(result.receiverId, "new_message", payload);

            } catch (error) {
                socket.emit("message_error", {
                    message: error.message
                });
            }
        });

        // NEW: typing indicator — sender tells us they're typing, we
        // relay it only to the other person in that conversation.
        socket.on("typing", ({ conversationId, receiverId }) => {
            emitToUser(receiverId, "user_typing", { conversationId, userId });
        });

        socket.on("stop_typing", ({ conversationId, receiverId }) => {
            emitToUser(receiverId, "user_stop_typing", { conversationId, userId });
        });

        // NEW: read receipts — when this user views a conversation, mark
        // the other person's messages read and tell them so their sent
        // bubbles can flip to "seen".
        socket.on("mark_read", async ({ conversationId, otherUserId }) => {
            if (!(await ensureSession(socket))) return;
            try {
                await ConversationService.markConversationRead(userId, conversationId);
                emitToUser(otherUserId, "conversation_read", {
                    conversationId,
                    readByUserId: userId,
                });
            } catch (error) {
                // silent — the REST PATCH /:conversationId/read endpoint
                // still exists as a fallback if this fails
            }
        });

        // Disconnect
        socket.on("disconnect", () => {

            const sockets = onlineUsers.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                // only "offline" once their last tab/connection is gone
                if (sockets.size === 0) {
                    onlineUsers.delete(userId);
                    socket.broadcast.emit("user_offline", { userId });
                }
            }

            console.log(`User ${userId} disconnected`);
        });
    });
};

module.exports = setupSocket;
