const userRepository = require("./userManagement.repository");
const AppError = require('../../utils/AppError')
const NotificationService = require('../notification/notification.service')

const UserService = {

    async getUsers(filters, page, limit) {
        const currentPage = Number(page) || 1;
        const currentLimit = Number(limit) || 10;

        const offset = (currentPage - 1) * currentLimit;

        const users = await userRepository.findUsers(
            filters,
            offset,
            currentLimit
        );

        const total = await userRepository.countUsers(filters);

        const totalPages = Math.ceil(total / currentLimit);

        return {
            users,
            pagination: {
                page: currentPage,
                limit: currentLimit,
                total,
                totalPages
            }
        };
    },

    async getUserById(id) {
        const user = await userRepository.findUserById(id)
        if (!user) {
            throw new AppError("user not found", 404)
        }

        return user
    },

    async updateUserStatus(id, status, adminId, reason) {
        const user = await userRepository.findUserById(id)
        if (!user) {
            throw new AppError("user not found", 404)
        }
        if (user.status === status) {
            throw new AppError("User already has this status", 400);
        }

        const allowedTransitions = {
            PENDING: ["ACTIVE", "REJECTED"],
            ACTIVE: ["BLOCKED"],
            BLOCKED: ["ACTIVE"],
            REJECTED: []
        };

        if (!allowedTransitions[user.status]?.includes(status)) {
            throw new AppError(`Cannot change status from ${user.status} to ${status}`, 400);
        }

        if (status === "REJECTED" && !reason) {
            throw new AppError("Rejection reason is required", 400);
        }

        const result = await userRepository.updateUserStatus(id, status, adminId, reason)

        // only approval / reinstatement is worth a notification: a blocked or rejected user
        // can't sign in to read one
        if (status === "ACTIVE") {
            await NotificationService.notifyAccountActivated({ userId: Number(id), previousStatus: user.status })
        }

        return result
    }

};

module.exports = UserService;