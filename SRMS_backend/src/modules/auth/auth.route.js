const express = require("express");
const AuthController = require("./auth.controller");
const validate = require("../../middlewares/validationMiddleware");
const { registerSchema,loginSchema,forgotPasswordSchema,resetPasswordSchema} = require("./auth.validation");
const verifyToken = require('../../middlewares/authMiddleware');

const router = express.Router();

router.post("/register",validate(registerSchema),AuthController.register);

router.post("/login",validate(loginSchema),AuthController.login);

router.post("/logout",verifyToken,AuthController.logout);

router.post("/forgot-password",validate(forgotPasswordSchema),AuthController.forgotPassword);

router.post("/reset-password",validate(resetPasswordSchema),AuthController.resetPassword);

module.exports = router;