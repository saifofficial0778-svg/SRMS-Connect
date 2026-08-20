const express = require("express");
const ProfileController = require("./profile.controller");
const verifyToken = require("../../middlewares/authMiddleware");
const {updateProfileSchema,addSkillSchema,addProjectSchema}=require('./profile.validation')
const {validate}=require('../../middlewares/validationMiddleware')

const router = express.Router();

router.get("/",verifyToken,ProfileController.getProfile);

router.patch('/',verifyToken,validate(updateProfileSchema),ProfileController.updateProfile)

router.post('/skills',verifyToken,validate(addSkillSchema),ProfileController.addSkill)

router.delete('/skills/:skillId',verifyToken,ProfileController.deleteSkill)

router.post('/projects',verifyToken,validate(addProjectSchema),ProfileController.addProject)

router.delete('/projects/:projectId',verifyToken,ProfileController.deleteProject)

module.exports = router;