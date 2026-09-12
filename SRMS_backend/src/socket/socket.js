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

                // Sender confirmation
                socket.emit("message_sent", {
                    conversationId,
                    messageId: result.messageId,
                    senderId: userId,
                    content: content.trim()
                });

                // Receiver gets message instantly
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("new_message", {
                        conversationId,
                        messageId: result.messageId,
                        senderId: userId,
                        content: content.trim()
                    });
                }

            } catch (error) {
                socket.emit("message_error", {
                    message: error.message
                });
            }
        });

        // Disconnect
        socket.on("disconnect", () => {

            onlineUsers.delete(userId);

            console.log(`User ${userId} disconnected`);
        });
    });
};

module.exports = setupSocket;