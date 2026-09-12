const express = require("express");
const router = express.Router();

const { validate } = require("../../middlewares/validationMiddleware");
const { sendMessageSchema } = require("./chat.validation");

const ChatController = require("./chat.controller");
const verifyToken = require("../../middlewares/authMiddleware");

router.get("/:userId",verifyToken,ChatController.getOrCreateConversation);

router.post("/:conversationId/messages",verifyToken,validate(sendMessageSchema),ChatController.sendMessage);

module.exports = router;