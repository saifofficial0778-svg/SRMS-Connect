const ConversationRepository = require("./chat.repository");
const ConnectionRepository = require("../connection/connection.repository");
const AppError = require("../../utils/AppError");

const ConversationService = {

    async getOrCreateConversation(userOneId, userTwoId) {

        const connection =
            await ConnectionRepository.findConnection(userOneId, userTwoId);

        if (!connection) {
            throw new AppError("Connection not found", 404);
        }

        if (connection.status !== "ACCEPTED") {
            throw new AppError("You can chat only with connections", 403);
        }

        const conversation = await ConversationRepository.findConversation(userOneId, userTwoId);

        if (!conversation) {
            const newConversationId = await ConversationRepository.createConversation(userOneId, userTwoId);
            return newConversationId;
        }

    
        return conversation.id;
    },

    async sendMessage(conversationId, senderId, content) {
        const conversation = await ConversationRepository.findConversationById(conversationId)

        if (!conversation) {
            throw new AppError("Conversation not found", 404);
        }

        if (conversation.user_one_id !== senderId && conversation.user_two_id !== senderId
        ) {
            throw new AppError("You can't send the message", 403);
        }

        if (!content || !content.trim()) {
            throw new AppError("Message cannot be empty", 400);
        }

        const messageId = await ConversationRepository.createMessage(conversationId, senderId, content.trim());

        const receiverId =
            conversation.user_one_id === senderId
                ? conversation.user_two_id
                : conversation.user_one_id;

        return {
            messageId,
            receiverId,
            createdAt: new Date().toISOString(),
        };
    },

    async getConversations(userId) {
        const rows = await ConversationRepository.findConversationsByUser(userId);

        return rows.map((r) => ({
            conversationId: r.conversation_id,
            otherUser: {
                id: r.other_user_id,
                full_name: r.full_name,
                profile_photo: r.profile_photo,
            },
            lastMessage: r.last_message_content !== null
                ? {
                    content: r.last_message_content,
                    createdAt: r.last_message_at,
                    senderId: r.last_message_sender_id,
                }
                : null,
            unreadCount: Number(r.unread_count) || 0,
        }));
    },

  
    async getMessages(userId, conversationId, page, limit) {
        const conversation = await ConversationRepository.findConversationById(conversationId);
        if (!conversation) {
            throw new AppError("Conversation not found", 404);
        }
        if (conversation.user_one_id !== userId && conversation.user_two_id !== userId) {
            throw new AppError("You don't have access to this conversation", 403);
        }

        const offset = (page - 1) * limit;
        const rows = await ConversationRepository.findMessagesByConversationId(
            conversationId,
            limit,
            offset
        );

       
        return rows.reverse();
    },

    
    async markConversationRead(userId, conversationId) {
        const conversation = await ConversationRepository.findConversationById(conversationId);
        if (!conversation) {
            throw new AppError("Conversation not found", 404);
        }
        if (conversation.user_one_id !== userId && conversation.user_two_id !== userId) {
            throw new AppError("You don't have access to this conversation", 403);
        }

        return await ConversationRepository.markConversationRead(conversationId, userId);
    },

};

module.exports = ConversationService;
