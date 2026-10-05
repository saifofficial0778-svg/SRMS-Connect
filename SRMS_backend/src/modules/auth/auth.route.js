const express = require("express");
const AuthController = require("./auth.controller");
const { validate } = require("../../middlewares/validationMiddleware");
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, requestOtpSchema, verifyOtpSchema, verifyRegisterOtpSchema, resendRegisterOtpSchema } = require("./auth.validation");
const verifyToken = require('../../middlewares/authMiddleware');

const router = express.Router();

router.post("/register", validate(registerSchema), AuthController.register);
router.post("/register/verify-otp", validate(verifyRegisterOtpSchema), AuthController.verifyRegisterOtp);
router.post("/register/resend-otp", validate(resendRegisterOtpSchema ), AuthController.resendRegisterOtp);

router.post("/login", validate(loginSchema), AuthController.login);

router.post("/logout", verifyToken, AuthController.logout);

router.post("/forgot-password", validate(forgotPasswordSchema), AuthController.forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), AuthController.resetPassword);

router.post("/otp/request", validate(requestOtpSchema), AuthController.requestOtp);

router.post("/otp/verify", validate(verifyOtpSchema), AuthController.verifyOtp);

module.exports = router;