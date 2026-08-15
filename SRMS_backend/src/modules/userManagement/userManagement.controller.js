const UserService=require('./userManagement.service')
const catchAsync=require('../../utils/catchAsync')

const UserController = {

    getUsers: catchAsync(async (req, res) => {
        const { role, status, search, page, limit } = req.validatedQuery;

        const users = await UserService.getUsers(
            { role, status, search },
            page,
            limit
        );

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users
        });
    }),

};

module.exports = UserController;