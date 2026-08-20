const { z } = require("zod");

const updateProfileSchema = z.object({
    full_name: z.string().trim().min(2).max(100).optional(),
    profile_photo: z.string().url().max(500).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    linkedin_url: z.string().url().max(500).optional(),
    github_url: z.string().url().max(500).optional(),
    portfolio_url: z.string().url().max(500).optional(),
    resume_url: z.string().url().max(500).optional(),
    company: z.string().max(150).optional(),
    designation: z.string().max(150).optional(),
    experience_years: z.number().min(0).max(50).optional(),
    interests: z.string().max(500).optional(),
    career_goals: z.string().max(500).optional()
}).strict();

const addSkillSchema = z.object({
    skill: z.string().trim().min(1).max(100)
});

const addProjectSchema = z.object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().max(2000).optional(),
    project_url: z.string().url().max(500).optional()
});

module.exports = {
    updateProfileSchema,
    addSkillSchema,
    addProjectSchema
};