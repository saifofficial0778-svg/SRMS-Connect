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
        const [result] = await pool.execute(
            `
            SELECT id,user_id,content,status,deleted_at
            FROM posts
            WHERE id=?
            `, [postId]
        )
        return result[0]
    },

    async updatePostContent(postId, content) {
        const [result] = await pool.execute(
            `
            UPDATE posts
            SET 
                content=?
            WHERE
                id=?
                AND status = 'ACTIVE'
                AND deleted_at IS NULL
            `, [content, postId]
        )
        return result.affectedRows
    },

    async findPostMedia(postId) {
        const [result] = await pool.execute(
            `
            SELECT id,post_id,media_url,public_id
            FROM post_media
            WHERE post_id=?
            `, [postId]
        )
        return result
    },

    async updatePost(connection, postId) {
        const [result] = await connection.execute(
            `
        UPDATE posts
        SET deleted_at = CURRENT_TIMESTAMP,
            status = 'DELETED'
        WHERE id = ?
        AND deleted_at IS NULL
        `,
            [postId]
        );

        return result.affectedRows;
    },
    async deletePostMedia(connection, postId) {
        const [result] = await connection.execute(
            `
            DELETE FROM post_media
            WHERE post_id=?
            `, [postId]
        )
        return result.affectedRows
    },

    async findLike(postId, userId) {
        const [result] = await pool.execute(
            `
            SELECT id ,post_id,user_id
            FROM post_likes
            WHERE post_id = ?
            AND user_id = ?
            `, [postId, userId]
        )
        return result[0]
    },

    async createLike(postId, userId) {
        const [result] = await pool.execute(
            `
            INSERT INTO post_likes(
            post_id,
            user_id
            )
            VALUES (?,?)
            `, [postId, userId]
        )
        return result.insertId
    },

    async deleteLike(postId, userId) {
        const [result] = await pool.execute(
            `
        DELETE FROM post_likes
        WHERE post_id = ?
        AND user_id = ?
        `,
            [postId, userId]
        );

        return result.affectedRows;
    },

    async unlikePost(userId, postId) {
        const result = await PostRepository.deleteLike(postId, userId);

        if (!result) {
            throw new AppError("Like not found", 404);
        }

        return true;
    },
    async createComment(postId, userId, content) {
        const [result] = await pool.execute(
            `
        INSERT INTO post_comments (
            post_id,
            user_id,
            content
        )
        VALUES (?, ?, ?)
        `,
            [postId, userId, content]
        );

        return result.insertId;
    },

    async findCommentById(commentId) {
        const [result] = await pool.execute(
            `
        SELECT id, post_id, user_id, content
        FROM post_comments
        WHERE id = ?
        LIMIT 1
        `,
            [commentId]
        );

        return result[0];
    },

    async updateComment(commentId, content) {
        const [result] = await pool.execute(
            `
        UPDATE post_comments
        SET content = ?
        WHERE id = ?
        `,
            [content, commentId]
        );

        return result.affectedRows;
    },

    async deleteComment(commentId) {
        const [result] = await pool.execute(
            `
        DELETE FROM post_comments
        WHERE id = ?
        `,
            [commentId]
        );

        return result.affectedRows;
    },
};

module.exports = PostRepository;