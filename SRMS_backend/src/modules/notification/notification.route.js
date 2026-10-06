const express = require("express");
const NotificationController = require("./notification.controller");
const { validateQuery } = require("../../middlewares/validationMiddleware");
const { listNotificationsSchema } = require("./notification.validation");
const verifyToken = require("../../middlewares/authMiddleware");

const router = express.Router();

router.use(verifyToken);

router.get("/", validateQuery(listNotificationsSchema), NotificationController.list);

router.get("/unread-count", NotificationController.unreadCount);

// fixed paths first so "read-all" is never taken for an :id
router.patch("/read-all", NotificationController.markAllRead);

router.patch("/:id/read", NotificationController.markRead);

module.exports = router;
