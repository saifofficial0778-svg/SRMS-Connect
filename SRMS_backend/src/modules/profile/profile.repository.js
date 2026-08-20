const { object } = require("zod");
const pool = require("../../config/db");

const ProfileRepository = {

    async findProfileByUserId(userId) {
        const [result] = await pool.execute(
            `
        SELECT
            id,
            user_id,
            full_name,
            profile_photo,
            bio,
            location,
            linkedin_url,
            github_url,
            portfolio_url,
            resume_url,
            company,
            designation,
            experience_years,
            interests,
            career_goals
        FROM profiles
        WHERE user_id = ?
        LIMIT 1
        `,
            [userId]
        );

        return result[0];
    },

    async updateProfile(userId, profileData) {
        const fields = []
        const values = []

        for (const [key, value] of Object.entries(profileData)) {
            fields.push(`${key} = ?`);
            values.push(value)


        }
        if (!fields.length) {
            return 0;
        }

        values.push(userId);

        const [result] = await pool.execute(
            `
            UPDATE profiles
            SET ${fields.join(", ")}
            WHERE user_id=?
            `, values
        )
        return result.affectedRows
    },

    async findSkill(profileId, skill) {
        const [result] = await pool.execute(
            `
        SELECT id
        FROM profile_skills
        WHERE profile_id = ?
        AND skill = ?
        LIMIT 1
        `,
            [profileId, skill]
        );

        return result[0];
    },

    async createSkill(profileId, skill) {
        const [result] = await pool.execute(
            `
        INSERT INTO profile_skills (
            profile_id,
            skill
        )
        VALUES (?, ?)
        `,
            [profileId, skill]
        );

        return result.insertId;
    },

    async deleteSkill(profileId, skillId) {
        const [result] = await pool.execute(
            `
        DELETE FROM profile_skills
        WHERE id = ?
        AND profile_id = ?
        `,
            [skillId, profileId]
        );

        return result.affectedRows;
    },

    async createProject(profileId, projectData) {
        const { title, description, project_url } = projectData;

        const [result] = await pool.execute(
            `
        INSERT INTO profile_projects (
            profile_id,
            title,
            description,
            project_url
        )
        VALUES (?, ?, ?, ?)
        `,
            [profileId, title, description, project_url]
        );

        return result.insertId;
    },

    async deleteProject(profileId, projectId) {
        const [result] = await pool.execute(
            `
        DELETE FROM profile_projects
        WHERE id = ?
        AND profile_id = ?
        `,
            [projectId, profileId]
        );

        return result.affectedRows;
    },

    

};

module.exports = ProfileRepository;