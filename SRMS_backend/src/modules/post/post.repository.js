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

    async getFeed(userId, limit, offset) {
        const [rows] = await pool.execute(
            `SELECT *,
            (
                connection_score
                + (likes_count * 2)
                + (comments_count * 3)
                + recency_score
            ) AS total_score
        FROM (
            SELECT
                p.id,
                p.user_id,
                p.content,
                p.created_at,

                pr.full_name,
                pr.profile_photo,
                pr.bio,

                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM connections c
                        WHERE c.status = 'ACCEPTED'
                        AND (
                            (c.sender_id = ? AND c.receiver_id = p.user_id)
                            OR
                            (c.receiver_id = ? AND c.sender_id = p.user_id)
                        )
                    )
                    THEN 10
                    ELSE 0
                END AS connection_score,

                (
                    SELECT COUNT(*)
                    FROM post_likes pl
                    WHERE pl.post_id = p.id
                ) AS likes_count,

                (
                    SELECT COUNT(*)
                    FROM post_comments pc
                    WHERE pc.post_id = p.id
                ) AS comments_count,

                CASE
                    WHEN TIMESTAMPDIFF(HOUR, p.created_at, NOW()) <= 1 THEN 10
                    WHEN TIMESTAMPDIFF(HOUR, p.created_at, NOW()) <= 6 THEN 7
                    WHEN TIMESTAMPDIFF(HOUR, p.created_at, NOW()) <= 24 THEN 5
                    ELSE 2
                END AS recency_score,

                EXISTS (
                    SELECT 1
                    FROM post_likes my_like
                    WHERE my_like.post_id = p.id
                    AND my_like.user_id = ?
                ) AS is_liked

            FROM posts p

            JOIN profiles pr
                ON pr.user_id = p.user_id

            WHERE p.status = 'ACTIVE'
              AND p.deleted_at IS NULL

        ) AS feed

        ORDER BY total_score DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
            [userId, userId, userId]
        );

        return rows;
    },
};

module.exports = PostRepository;