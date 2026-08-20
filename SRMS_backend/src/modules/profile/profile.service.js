const ProfileRepository = require("./profile.repository");
const AppError = require('../../utils/AppError')

const ProfileService = {

    async getProfile(userId) {
        const profile = await ProfileRepository.findProfileByUserId(userId)
        if (!profile) {
            throw new AppError("profile not found", 404)

        }
        return profile

    },

    async updateProfile(userId, profileData) {
        const profile = await ProfileRepository.findProfileByUserId(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        return await ProfileRepository.updateProfile(userId, profileData);
    },

    async addSkill(userId, skill) {
        const profile = await ProfileRepository.findProfileByUserId(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        const isSkill = await ProfileRepository.findSkill(profile.id, skill)
        if (isSkill) {
            throw new AppError("skill already exist ", 409)
        }

        const result = await ProfileRepository.createSkill(profile.id, skill)
        return result
    },

    async deleteSkill(userId, skillId) {
        const profile = await ProfileRepository.findProfileByUserId(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        const result = await ProfileRepository.deleteSkill(
            profile.id,
            skillId
        );

        if (!result) {
            throw new AppError("Skill not found", 404);
        }

        return true;
    },

    async addProject(userId, projectData) {

        const profile = await ProfileRepository.findProfileByUserId(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        const result = await ProfileRepository.createProject(profile.id, projectData)
        return result


    },

    async deleteProject(userId, projectId) {
        const profile = await ProfileRepository.findProfileByUserId(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        const result = await ProfileRepository.deleteProject(
            profile.id,
            projectId
        );

        if (!result) {
            throw new AppError("Project not found", 404);
        }

        return true;
    },

};

module.exports = ProfileService;