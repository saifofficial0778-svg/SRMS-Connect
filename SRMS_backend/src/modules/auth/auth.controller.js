const AuthService = require("./auth.service");
const catchAsync = require('../../utils/catchAsync')

const AuthController = {

    register: catchAsync(async (req, res) => {

        const user = await AuthService.register(req.body)
        return res.status(201).json({
            success: true,
            message: "user create successfully",
            data: user
        })
    }),

    login: catchAsync(async (req, res) => {
        const { enrollment, password } = req.body;
        const sessionInfo = {
            deviceInfo: req.headers["user-agent"],
            ipAddress: req.ip
        };

        const user = await AuthService.login(enrollment, password, sessionInfo);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: user
        });
    }),

    logout: catchAsync(async (req, res) => {
        const { userId, token } = req.user;

        await AuthService.logout(userId, token);

        return res.status(200).json({
            success: true,
            message: "Logout successful"
        });
    }),

    forgotPassword: catchAsync(async (req, res) => {
        const { enrollment } = req.body;

        const result = await AuthService.forgotPassword(enrollment);

        return res.status(200).json({
            success: true,
            message: "Password reset token generated",
            data: result
        });
    }),

    resetPassword: catchAsync(async (req, res) => {
        const { resetToken, newPassword } = req.body;

        await AuthService.resetPassword(resetToken, newPassword);

        return res.status(200).json({
            success: true,
            message: "Password reset successful"
        });
    }),

};

module.exports = AuthController;