const userRepository = require("./userManagement.repository");

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
    }

};

module.exports = UserService;