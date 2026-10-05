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

   
    verifyRegisterOtp: catchAsync(async (req, res) => {
        const { enrollment, otp } = req.body;
        const result = await AuthService.verifyRegisterOtp(enrollment, otp);
        return res.status(200).json({
            success: true,
            data: result
        });
    }),

    
    resendRegisterOtp: catchAsync(async (req, res) => {
        const { enrollment } = req.body;
        const result = await AuthService.resendRegisterOtp(enrollment);
        return res.status(200).json({
            success: true,
            data: result
        });
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

    requestOtp: catchAsync(async (req, res) => {
        const { enrollment } = req.body;
        const result = await AuthService.requestOtp(enrollment);
        return res.status(200).json({ success: true, ...result });
    }),

    verifyOtp: catchAsync(async (req, res) => {
        const { enrollment, otp } = req.body;
        const sessionInfo = {
            deviceInfo: req.headers["user-agent"],
            ipAddress: req.ip
        };
        const result = await AuthService.verifyOtp(enrollment, otp, sessionInfo);
        return res.status(200).json({ success: true, data: result });
    })

};

module.exports = AuthController;