const ConnectionRepository = require("./connection.repository");
const userRepository = require("../userManagement/userManagement.repository");
const AppError = require("../../utils/AppError");

const ConnectionService = {

    async sendRequest(senderId, receiverId) {
        if (senderId === Number(receiverId)) {
            throw new AppError("You cannot send request to yourself", 400);
        }

        const receiver = await userRepository.findUserById(receiverId);

        if (!receiver) {
            throw new AppError("User not found", 404);
        }

        const existingConnection = await ConnectionRepository.findConnection(
            senderId,
            receiverId
        );

        if (existingConnection) {
            throw new AppError("Connection already exists", 409);
        }

        const result = await ConnectionRepository.createConnection(
            senderId,
            receiverId
        );

        return result;
    },

    async acceptRequest(userId, connectionId) {
        const connection =
            await ConnectionRepository.findConnectionById(connectionId);

        if (!connection) {
            throw new AppError("Connection not found", 404);
        }

        if (connection.receiver_id !== userId) {
            throw new AppError("You are not allowed to accept this request", 403);
        }

        if (connection.status !== "PENDING") {
            throw new AppError("Request cannot be accepted", 400);
        }

        await ConnectionRepository.updateStatus(connectionId, "ACCEPTED");

        return true;
    },

    async rejectRequest(userId, connectionId) {
        const connection =
            await ConnectionRepository.findConnectionById(connectionId);

        if (!connection) {
            throw new AppError("Connection not found", 404);
        }

        if (connection.receiver_id !== userId) {
            throw new AppError("You are not allowed to reject this request", 403);
        }

        if (connection.status !== "PENDING") {
            throw new AppError("Request cannot be rejected", 400);
        }

        await ConnectionRepository.updateStatus(connectionId, "REJECTED");

        return true;
    },

    async cancelRequest(userId, connectionId) {
        const connection =
            await ConnectionRepository.findConnectionById(connectionId);

        if (!connection) {
            throw new AppError("Connection not found", 404);
        }

        if (connection.sender_id !== userId) {
            throw new AppError("You are not allowed to cancel this request", 403);
        }

        if (connection.status !== "PENDING") {
            throw new AppError("Request cannot be cancelled", 400);
        }

        await ConnectionRepository.updateStatus(connectionId, "CANCELLED");

        return true;
    },
    async removeConnection(userId, connectionId) {
        const connection =
            await ConnectionRepository.findConnectionById(connectionId);

        if (!connection) {
            throw new AppError("Connection not found", 404);
        }

        const isParticipant =
            connection.sender_id === userId ||
            connection.receiver_id === userId;

        if (!isParticipant) {
            throw new AppError("You are not part of this connection", 403);
        }

        if (connection.status !== "ACCEPTED") {
            throw new AppError("Connection is not active", 400);
        }

        await ConnectionRepository.updateStatus(connectionId, "REMOVED");

        return true;
    },

    async getMyConnections(userId) {
        return await ConnectionRepository.getMyConnections(userId);
    },

    async getReceivedRequests(userId) {
        return await ConnectionRepository.getReceivedRequests(userId);
    },

    async getSentRequests(userId) {
        return await ConnectionRepository.getSentRequests(userId);
    }

};

module.exports = ConnectionService;