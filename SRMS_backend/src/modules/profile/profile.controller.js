const ProfileService = require("./profile.service");
const catchAsync = require("../../utils/catchAsync");

const ProfileController = {

    getProfile: catchAsync(async (req, res) => {
        const { userId } = req.user;

        const profile = await ProfileService.getProfile(userId);

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: profile
        });
    }),

    updateProfile: catchAsync(async (req, res) => {
        const { userId } = req.user;

        const result = await ProfileService.updateProfile(
            userId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: result
        });
    }),

    addSkill: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { skill } = req.body;

        const result = await ProfileService.addSkill(userId, skill);

        return res.status(201).json({
            success: true,
            message: "Skill added successfully",
            data: result
        });
    }),

    deleteSkill: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { skillId } = req.params;

        await ProfileService.deleteSkill(userId, skillId);

        return res.status(200).json({
            success: true,
            message: "Skill deleted successfully"
        });
    }),
    addProject: catchAsync(async (req, res) => {
        const { userId } = req.user;

        const projectId = await ProfileService.addProject(
            userId,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "Project added successfully",
            data: projectId
        });
    }),

    deleteProject: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { projectId } = req.params;

        await ProfileService.deleteProject(userId, projectId);

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });
    }),
};

module.exports = ProfileController;