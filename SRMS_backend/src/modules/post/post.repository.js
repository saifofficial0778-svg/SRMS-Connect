const pool = require("../../config/db");

const PostRepository = {

    async createPost(connection, userId, content) {
        const [result] = await connection.execute(
            `
        INSERT INTO posts (
            user_id,
            content,
            status
        )
        VALUES (?, ?, "ACTIVE")
        `,
            [userId, content ?? null]
        );

        return result.insertId;
    },

    async createPostMedia(connection, postId, mediaData) {
        for (const media of mediaData) {
            const { mediaUrl, mediaType, publicId } = media;
            await connection.execute(
                `
                INSERT INTO post_media(
                post_id,
                media_url,
                media_type,
                public_id
                )
                VALUES (?, ?, ?, ?)
                `, [postId, mediaUrl, mediaType, publicId]
            )
        }
        return true

    },

    async findPostById(postId) {
        const [result]=await pool.execute(
            `
            SELECT id,user_id,content,status,deleted_at
            FROM posts
            WHERE id=?
            `,[postId]
        )
        return result[0]
    },

    async updatePostContent(postId, content) {
        const [result]=await pool.execute(
            `
            UPDATE posts
            SET 
                content=?
            WHERE
                id=?
                AND status = 'ACTIVE'
                AND deleted_at IS NULL
            `,[content,postId]
        )
        return result.affectedRows
    },

};

module.exports = PostRepository;