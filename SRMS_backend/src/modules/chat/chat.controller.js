const catchAsync = require("../../utils/catchAsync");
const ConversationService = require("./chat.service");

const ConversationController = {

  
    getConversations: catchAsync(async (req, res) => {
        const userId = req.user.userId;

        const conversations = await ConversationService.getConversations(userId);

        res.status(200).json({
            success: true,
            data: conversations
        });
    }),

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

    
    getMessages: catchAsync(async (req, res) => {
        const userId = req.user.userId;
        const { conversationId } = req.params;
        const { page, limit } = req.validatedQuery;

        const messages = await ConversationService.getMessages(
            userId,
            conversationId,
            page,
            limit
        );

        res.status(200).json({
            success: true,
            data: { messages, pagination: { page, limit } }
        });
    }),

    sendMessage: catchAsync(async (req, res) => {
        const senderId = req.user.userId;
        const { conversationId } = req.params;
        const { content } = req.body;

        const result = await ConversationService.sendMessage(
            conversationId,
            senderId,
            content
        );

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: {
                messageId: result.messageId,
                createdAt: result.createdAt
            }
        });
    }),

    markRead: catchAsync(async (req, res) => {
        const userId = req.user.userId;
        const { conversationId } = req.params;

        await ConversationService.markConversationRead(userId, conversationId);

        res.status(200).json({
            success: true,
            message: "Conversation marked as read"
        });
    }),

};

module.exports = ConversationController;
