const express = require("express");
const AuthController = require("./auth.controller");
const validate = require("../../middlewares/validationMiddleware");
const { registerSchema } = require("./auth.validation");

const router = express.Router();

router.post(
    "/register",
    validate(registerSchema),
    AuthController.register
);

module.exports = router;