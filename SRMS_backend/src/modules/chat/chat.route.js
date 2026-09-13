const express = require("express");
const router = express.Router();

const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const { sendMessageSchema, messageQuerySchema } = require("./chat.validation");

const ChatController = require("./chat.controller");
const verifyToken = require("../../middlewares/authMiddleware");


router.get("/conversations", verifyToken, ChatController.getConversations);

router.get("/:userId", verifyToken, ChatController.getOrCreateConversation);

router.get(
    "/:conversationId/messages",
    verifyToken,
    validateQuery(messageQuerySchema),
    ChatController.getMessages
);

router.post(
    "/:conversationId/messages",
    verifyToken,
    validate(sendMessageSchema),
    ChatController.sendMessage
);

router.patch("/:conversationId/read", verifyToken, ChatController.markRead);

module.exports = router;
