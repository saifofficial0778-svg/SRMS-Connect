const express = require("express");
const UserController = require("./userManagement.controller");
const verifyToken = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/authorizeRole");
const { getUsersSchema} = require("./userManagement.validation");
const {validateQuery}= require("../../middlewares/validationMiddleware");

const router = express.Router();

router.get("/",verifyToken,requireRole("ADMIN"),validateQuery(getUsersSchema),UserController.getUsers);

module.exports = router;