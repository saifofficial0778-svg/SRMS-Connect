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
        let newConversation
        const conversation = await ConversationRepository.findConversation(userOneId, userTwoId)
        if (!conversation) {
            newConversation = await ConversationRepository.createConversation(userOneId, userTwoId)

            return newConversation
        }

        return connection.id

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
            receiverId
        };
    }

};

module.exports = ConversationService;