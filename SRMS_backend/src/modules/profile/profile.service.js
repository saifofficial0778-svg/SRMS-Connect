const ProfileRepository = require("./profile.repository");
const AppError = require('../../utils/AppError')
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const deleteFromCloudinary = require("../../utils/deleteFromCloudinary");
const { ALUMNI_ONLY_INTENTS } = require("./profile.constants");
const SkillService = require("../skill/skill.service");
const AnalyticsService = require("../analytics/analytics.service");

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

    async updateOpenTo(userId, role, intents) {
        const profile = await ProfileRepository.findProfileByUserId(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        // role comes from the verified session, never from the request body
        if (role !== "ALUMNI" && intents.some((i) => ALUMNI_ONLY_INTENTS.includes(i))) {
            throw new AppError("Only alumni can mark themselves as Hiring", 403);
        }

        await ProfileRepository.replaceOpenTo(profile.id, intents);
        return { open_to: intents };
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

        // a different spelling of a skill already on the profile is the same skill
        const { key } = await SkillService.canonicalize(skill);
        for (const existing of profile.skills || []) {
            if ((await SkillService.canonicalize(existing.skill)).key === key) {
                throw new AppError(`You already have this skill (listed as "${existing.skill}")`, 409);
            }
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

    async updateProfilePhoto(userId, file) {
        if (!file) {
            throw new AppError("Profile photo is required", 400);
        }

        const oldPhoto = await ProfileRepository.getProfilePhoto(userId);

        const uploadResult = await uploadToCloudinary(
            file.buffer,
            "srms-connect/profiles",
            "image"
        );

        if (
            oldPhoto?.profile_photo_public_id
        ) {
            await deleteFromCloudinary(
                oldPhoto.profile_photo_public_id,
                "image"
            );
        }

        await ProfileRepository.updateProfilePhoto(
            userId,
            uploadResult.secure_url,
            uploadResult.public_id
        );

        return {
            profilePhoto: uploadResult.secure_url
        };
    },

    async deleteProfilePhoto(userId) {
        const oldPhoto = await ProfileRepository.getProfilePhoto(userId);

        if (!oldPhoto?.profile_photo_public_id) {
            throw new AppError("No profile photo to remove", 400);
        }

        await deleteFromCloudinary(oldPhoto.profile_photo_public_id, "image");
        await ProfileRepository.clearProfilePhoto(userId);

        return {
            profilePhoto: null
        };
    },

    // viewer = { userId, role } from the session; when given, the visit is counted for the owner's analytics
    async getPublicProfile(userId, viewer) {
        const profile = await ProfileRepository.findPublicProfileById(userId);

        if (!profile) {
            throw new AppError("Profile not found", 404);
        }

        if (viewer) {
            await AnalyticsService.trackProfileView(viewer, userId);
        }

        return profile;
    },

};

module.exports = ProfileService;