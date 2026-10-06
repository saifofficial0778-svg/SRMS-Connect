const express = require("express");
const AuthController = require("./auth.controller");
const { validate } = require("../../middlewares/validationMiddleware");
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyForgotOtpSchema, requestOtpSchema, verifyOtpSchema, verifyRegisterOtpSchema, resendRegisterOtpSchema } = require("./auth.validation");
const verifyToken = require('../../middlewares/authMiddleware');
const { authIpLimiter, loginLimiter, otpSendLimiter, otpVerifyLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

router.use(authIpLimiter);

router.post("/register", otpSendLimiter, validate(registerSchema), AuthController.register);
router.post("/register/verify-otp", otpVerifyLimiter, validate(verifyRegisterOtpSchema), AuthController.verifyRegisterOtp);
router.post("/register/resend-otp", otpSendLimiter, validate(resendRegisterOtpSchema ), AuthController.resendRegisterOtp);

router.post("/login", loginLimiter, validate(loginSchema), AuthController.login);

router.post("/logout", verifyToken, AuthController.logout);

router.post("/forgot-password", otpSendLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);

router.post("/forgot-password/verify-otp", otpVerifyLimiter, validate(verifyForgotOtpSchema), AuthController.verifyForgotPasswordOtp);

router.post("/reset-password", otpVerifyLimiter, validate(resetPasswordSchema), AuthController.resetPassword);

router.post("/otp/request", otpSendLimiter, validate(requestOtpSchema), AuthController.requestOtp);

router.post("/otp/verify", otpVerifyLimiter, validate(verifyOtpSchema), AuthController.verifyOtp);

module.exports = router;
