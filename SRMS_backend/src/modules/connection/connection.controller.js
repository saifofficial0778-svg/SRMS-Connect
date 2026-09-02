const catchAsync = require("../../utils/catchAsync");
const ConnectionService = require("./connection.service");

const ConnectionController = {
    sendRequest: catchAsync(async (req, res) => {
        const senderId = req.user.userId;
        const { userId: receiverId } = req.params;

        const result = await ConnectionService.sendRequest(
            senderId,
            receiverId
        );

        res.status(201).json({
            success: true,
            message: "Connection request sent",
            data: result
        });
    }),

    acceptRequest: catchAsync(async (req, res) => {
        const userId = req.user.userId;
        const { id } = req.params;

        await ConnectionService.acceptRequest(userId, id);

        res.status(200).json({
            success: true,
            message: "Connection request accepted"
        });
    }),

    rejectRequest: catchAsync(async (req, res) => {
        const userId = req.user.userId;
        const { id } = req.params;

        await ConnectionService.rejectRequest(userId, id);

        res.status(200).json({
            success: true,
            message: "Connection request rejected"
        });
    }),

    cancelRequest: catchAsync(async (req, res) => {
        const userId = req.user.userId;
        const { id } = req.params;

        await ConnectionService.cancelRequest(userId, id);

        res.status(200).json({
            success: true,
            message: "Connection request cancelled"
        });
    }),

    removeConnection: catchAsync(async (req, res) => {
        const userId = req.user.userId;
        const { id } = req.params;

        await ConnectionService.removeConnection(userId, id);

        res.status(200).json({
            success: true,
            message: "Connection removed"
        });
    }),

    getMyConnections: catchAsync(async (req, res) => {
        const userId = req.user.userId;

        const connections =
            await ConnectionService.getMyConnections(userId);

        res.status(200).json({
            success: true,
            data: connections
        });
    }),

    getReceivedRequests: catchAsync(async (req, res) => {
        const userId = req.user.userId;

        const requests =
            await ConnectionService.getReceivedRequests(userId);

        res.status(200).json({
            success: true,
            data: requests
        });
    }),

    getSentRequests: catchAsync(async (req, res) => {
        const userId = req.user.userId;

        const requests =
            await ConnectionService.getSentRequests(userId);

        res.status(200).json({
            success: true,
            data: requests
        });
    })
};

module.exports = ConnectionController;