const { object } = require("zod");
const pool = require("../../config/db");

const ProfileRepository = {

    async findProfileByUserId(userId) {
        const [result] = await pool.execute(
            `
        SELECT
            p.id,
            p.user_id,
            p.full_name,
            p.profile_photo,
            p.bio,
            p.location,
            p.linkedin_url,
            p.github_url,
            p.portfolio_url,
            p.resume_url,
            p.company,
            p.designation,
            p.experience_years,
            p.interests,
            p.career_goals,
            p.branch,
            p.batch_year,
            u.role,
            (u.role = 'ALUMNI') AS is_verified_alumni
        FROM profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?
        LIMIT 1
        `,
            [userId]
        );

        const profile = result[0];

        if (!profile) {
            return profile;
        }

        // NOTE: added so GET /profile can return skills + projects
        // in a single response for the frontend. No other query changed.
        const [skills] = await pool.execute(
            `
        SELECT id, skill
        FROM profile_skills
        WHERE profile_id = ?
        ORDER BY id ASC
        `,
            [profile.id]
        );

        const [projects] = await pool.execute(
            `
        SELECT id, title, description, project_url
        FROM profile_projects
        WHERE profile_id = ?
        ORDER BY id DESC
        `,
            [profile.id]
        );

        const open_to = await ProfileRepository.findOpenTo(profile.id);

        return {
            ...profile,
            skills,
            projects,
            open_to
        };
    },

    async findOpenTo(profileId) {
        const [rows] = await pool.execute(
            `SELECT intent FROM profile_open_to WHERE profile_id = ? ORDER BY id ASC`,
            [profileId]
        );
        return (rows || []).map((r) => r.intent);
    },

    // Replaces the whole set in one transaction so a failure can't leave half of it saved.
    async replaceOpenTo(profileId, intents) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(`DELETE FROM profile_open_to WHERE profile_id = ?`, [profileId]);
            for (const intent of intents) {
                await connection.execute(
                    `INSERT INTO profile_open_to (profile_id, intent) VALUES (?, ?)`,
                    [profileId, intent]
                );
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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

    async updateProfilePhoto(userId, photoUrl, publicId) {
        const [result] = await pool.execute(
            `UPDATE profiles
             SET profile_photo = ?,
                 profile_photo_public_id = ?
             WHERE user_id = ?`,
            [photoUrl, publicId, userId]
        );

        return result.affectedRows;
    },

    async getProfilePhoto(userId) {
        const [rows] = await pool.execute(
            `SELECT profile_photo, profile_photo_public_id
             FROM profiles
             WHERE user_id = ?`,
            [userId]
        );

        return rows[0];
    },

    async clearProfilePhoto(userId) {
        const [result] = await pool.execute(
            `UPDATE profiles
             SET profile_photo = NULL,
                 profile_photo_public_id = NULL
             WHERE user_id = ?`,
            [userId]
        );
        return result.affectedRows;
    },

    async findPublicProfileById(userId) {
        const [result] = await pool.execute(
            `
        SELECT
            p.id,
            p.user_id,
            p.full_name,
            p.profile_photo,
            p.bio,
            p.location,
            p.linkedin_url,
            p.github_url,
            p.portfolio_url,
            p.company,
            p.designation,
            p.experience_years,
            p.branch,
            p.batch_year,
            u.role,
            (u.role = 'ALUMNI') AS is_verified_alumni
        FROM profiles p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?
          AND u.status = 'ACTIVE'
        LIMIT 1
        `,
            [userId]
        );

        const profile = result[0];
        if (!profile) return profile;

        return { ...profile, open_to: await ProfileRepository.findOpenTo(profile.id) };
    },

};

module.exports = ProfileRepository;
