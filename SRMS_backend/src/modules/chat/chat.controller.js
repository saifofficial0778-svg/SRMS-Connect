const catchAsync = require("../../utils/catchAsync");
const ConversationService = require("./chat.service");

const ConversationController = {

    getOrCreateConversation: catchAsync(async (req, res) => {
        const userOneId = req.user.userId;
        const { userId: userTwoId } = req.params;

        const conversationId =
            await ConversationService.getOrCreateConversation(
                userOneId,
                userTwoId
            );

        res.status(200).json({
            success: true,
            message: "Conversation ready",
            data: {
                conversationId
            }
        });
    }),

    sendMessage: catchAsync(async (req, res) => {
        const senderId = req.user.userId;
        const { conversationId } = req.params;
        const { content } = req.body;

        const messageId = await ConversationService.sendMessage(
            conversationId,
            senderId,
            content
        );

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: {
                messageId
            }
        });
    }),

};

module.exports = ConversationController;