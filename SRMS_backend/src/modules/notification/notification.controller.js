const catchAsync = require("../../utils/catchAsync");
const NotificationService = require("./notification.service");

const NotificationController = {

    list: catchAsync(async (req, res) => {
        const data = await NotificationService.list(req.user.userId, req.validatedQuery);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    unreadCount: catchAsync(async (req, res) => {
        const data = await NotificationService.getUnreadCount(req.user.userId);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    markRead: catchAsync(async (req, res) => {
        const data = await NotificationService.markRead(req.user.userId, req.params.id);

        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data
        });
    }),

    markAllRead: catchAsync(async (req, res) => {
        const data = await NotificationService.markAllRead(req.user.userId);

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read",
            data
        });
    }),

};

module.exports = NotificationController;
