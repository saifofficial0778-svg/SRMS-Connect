const express = require("express");
const UserController = require("./userManagement.controller");
const verifyToken = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/authorizeRole");
const { getUsersSchema,updateUserStatusSchema} = require("./userManagement.validation");
const {validateQuery,validate}= require("../../middlewares/validationMiddleware");

const router = express.Router();

router.get("/",verifyToken,requireRole("ADMIN"),validateQuery(getUsersSchema),UserController.getUsers);

router.get('/:id',verifyToken,requireRole("ADMIN"),UserController.getUserById)

router.patch('/:id/status',verifyToken,requireRole("ADMIN"),validate(updateUserStatusSchema),UserController.updateUserStatus)

module.exports = router;