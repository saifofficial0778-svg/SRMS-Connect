const userRepository = require("./userManagement.repository");
const AppError = require('../../utils/AppError')

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

    async updateUserStatus(id, status) {
        const user = await userRepository.findUserById(id)
        if (!user) {
            throw new AppError("user not found", 404)
        }
        if (user.status === status) {
            throw new AppError("User already has this status", 400);
        }

        if (
            (user.status === "ACTIVE" && status !== "BLOCKED") ||
            (user.status === "BLOCKED" && status !== "ACTIVE")
        ) {
            throw new AppError("Invalid status transition", 400);
        }

        const result = await userRepository.updateUserStatus(id, status)

        return result
    }

};

module.exports = UserService;