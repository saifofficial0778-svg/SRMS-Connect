const ConnectionRepository = require("./connection.repository");
const userRepository = require("../userManagement/userManagement.repository");
const AppError = require("../../utils/AppError");
const NotificationService = require("../notification/notification.service");

const LIVE_STATUSES = ["PENDING", "ACCEPTED"];
const PROFILE_CONNECTIONS_LIMIT = 12;
const SUGGESTIONS_LIMIT = 8;

// What one member may see about another in a suggestion card: the same fields a public profile
// shows, plus how the VIEWER stands with them. Never e-mail, enrollment or anything from the account.
function toSuggestion(row, viewerId) {
    let relation = "none";
    if (row.viewer_status === "ACCEPTED") relation = "connected";
    else if (row.viewer_status === "PENDING") relation = row.viewer_sender_id === viewerId ? "sent" : "received";

    return {
        user_id: row.user_id,
        full_name: row.full_name || "SRMS Member",
        profile_photo: row.profile_photo,
        role: row.role,
        company: row.company,
        designation: row.designation,
        branch: row.branch,
        batch_year: row.batch_year,
        is_verified_alumni: row.role === "ALUMNI",
        relation,
        connection_id: relation === "none" ? null : row.viewer_connection_id,
    };
}

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

        // findConnection returns the live (PENDING/ACCEPTED) row first, so only a live
        // connection blocks a new request. Earlier REJECTED/CANCELLED/REMOVED rows stay as history.
        if (existingConnection && LIVE_STATUSES.includes(existingConnection.status)) {
            throw new AppError("Connection already exists", 409);
        }

        try {
            const connectionId = await ConnectionRepository.createConnection(
                senderId,
                receiverId
            );

            await NotificationService.notifyConnectionRequest({
                senderId,
                receiverId: Number(receiverId),
                connectionId,
            });

            return connectionId;
        } catch (error) {
            // two simultaneous requests: the unique live-pair index lets exactly one win
            if (error.code === "ER_DUP_ENTRY") {
                throw new AppError("Connection already exists", 409);
            }
            throw error;
        }
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

        await NotificationService.notifyConnectionAccepted({
            accepterId: userId,
            senderId: connection.sender_id,
            connectionId: connection.id,
        });
        await NotificationService.markConnectionRequestHandled(connection.id);

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

        await NotificationService.markConnectionRequestHandled(connection.id);

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

        await NotificationService.removeConnectionRequest(connection.id);

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

    // "People you may know": members the viewer is not connected with, the best-connected first.
    async getSuggestions(viewerId) {
        const rows = await ConnectionRepository.findSuggestions(viewerId, SUGGESTIONS_LIMIT);
        return {
            people: rows.map((row) => ({
                ...toSuggestion(row, viewerId),
                mutual_connections: Number(row.mutual_connections) || 0,
                same_branch: Boolean(row.same_branch),
            })),
        };
    },

    // "People <name> knows": shown under someone's profile so the viewer can grow their own network.
    async getProfileConnections(viewerId, rawProfileUserId) {
        const profileUserId = Number(rawProfileUserId);
        if (!Number.isInteger(profileUserId) || profileUserId < 1) {
            throw new AppError("Invalid user id", 400);
        }

        // a profile that can't be opened has no suggestions either
        const owner = await userRepository.findUserById(profileUserId);
        if (!owner || owner.status !== "ACTIVE" || owner.role === "ADMIN") {
            throw new AppError("User not found", 404);
        }

        const rows = await ConnectionRepository.findConnectionsOfUser(profileUserId, viewerId, PROFILE_CONNECTIONS_LIMIT);
        return { people: rows.map((row) => toSuggestion(row, viewerId)) };
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
module.exports.toSuggestion = toSuggestion;