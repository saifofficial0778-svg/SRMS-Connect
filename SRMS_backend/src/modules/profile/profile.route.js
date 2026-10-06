const express = require("express");
const ProfileController = require("./profile.controller");
const verifyToken = require("../../middlewares/authMiddleware");
const {updateProfileSchema,updateOpenToSchema,addSkillSchema,addProjectSchema}=require('./profile.validation')
const {validate}=require('../../middlewares/validationMiddleware')
const { profilePhoto, validateUploadedFiles } = require("../../middlewares/multerMiddleware");

const router = express.Router();

router.get("/",verifyToken,ProfileController.getProfile);

router.patch('/',verifyToken,validate(updateProfileSchema),ProfileController.updateProfile)

router.put("/open-to",verifyToken,validate(updateOpenToSchema),ProfileController.updateOpenTo);

router.patch("/photo",verifyToken,profilePhoto.single("photo"),validateUploadedFiles,ProfileController.updateProfilePhoto);

router.delete("/photo",verifyToken,ProfileController.deleteProfilePhoto);

router.post('/skills',verifyToken,validate(addSkillSchema),ProfileController.addSkill)

router.delete('/skills/:skillId',verifyToken,ProfileController.deleteSkill)

router.post('/projects',verifyToken,validate(addProjectSchema),ProfileController.addProject)

router.delete('/projects/:projectId',verifyToken,ProfileController.deleteProject)

router.get("/:userId", verifyToken, ProfileController.getPublicProfile);

module.exports = router;