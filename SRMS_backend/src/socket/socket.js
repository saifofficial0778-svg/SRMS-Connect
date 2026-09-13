const jwt = require("jsonwebtoken");
const ConversationService = require("../modules/chat/chat.service");

const onlineUsers = new Map();

const setupSocket = (io) => {

    // Socket JWT authentication
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error("Authentication token required"));
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            socket.user = decoded;

            next();
        } catch (error) {
            next(new Error("Invalid token"));
        }
    });

    // Connection
    io.on("connection", (socket) => {

        const userId = socket.user.userId;

        onlineUsers.set(userId, socket.id);

        console.log(`User ${userId} connected`);

        // let the newly-connected client know who else is online right now
        socket.emit("online_users", Array.from(onlineUsers.keys()));

        // tell everyone else this user just came online
        socket.broadcast.emit("user_online", { userId });

        // Send message
        socket.on("send_message", async (data) => {
            try {
                const { conversationId, content } = data;

                const result = await ConversationService.sendMessage(
                    conversationId,
                    userId,
                    content
                );

                const receiverSocketId =
                    onlineUsers.get(result.receiverId);

                const payload = {
                    conversationId,
                    messageId: result.messageId,
                    senderId: userId,
                    content: content.trim(),
                    createdAt: result.createdAt,
                };

                // Sender confirmation
                socket.emit("message_sent", payload);

                // Receiver gets message instantly
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("new_message", payload);
                }

            } catch (error) {
                socket.emit("message_error", {
                    message: error.message
                });
            }
        });

        // NEW: typing indicator — sender tells us they're typing, we
        // relay it only to the other person in that conversation.
        socket.on("typing", ({ conversationId, receiverId }) => {
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("user_typing", { conversationId, userId });
            }
        });

        socket.on("stop_typing", ({ conversationId, receiverId }) => {
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("user_stop_typing", { conversationId, userId });
            }
        });

        // NEW: read receipts — when this user views a conversation, mark
        // the other person's messages read and tell them so their sent
        // bubbles can flip to "seen".
        socket.on("mark_read", async ({ conversationId, otherUserId }) => {
            try {
                await ConversationService.markConversationRead(userId, conversationId);
                const otherSocketId = onlineUsers.get(otherUserId);
                if (otherSocketId) {
                    io.to(otherSocketId).emit("conversation_read", {
                        conversationId,
                        readByUserId: userId,
                    });
                }
            } catch (error) {
                // silent — the REST PATCH /:conversationId/read endpoint
                // still exists as a fallback if this fails
            }
        });

        // Disconnect
        socket.on("disconnect", () => {

            onlineUsers.delete(userId);

            socket.broadcast.emit("user_offline", { userId });

            console.log(`User ${userId} disconnected`);
        });
    });
};

module.exports = setupSocket;
