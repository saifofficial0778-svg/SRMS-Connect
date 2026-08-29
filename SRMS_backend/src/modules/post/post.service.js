const PostRepository = require("./post.repository");
const AppError = require("../../utils/AppError");
const pool = require("../../config/db");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const deleteFromCloudinary = require("../../utils/deleteFromCloudinary");

const PostService = {

    async createPost(userId, content, files) {
        if (!content && (!files || files.length === 0)) {
            throw new AppError("Post cannot be empty", 400);
        }

        if (files && files.length > 5) {
            throw new AppError("Not more than 5 media files are allowed", 400);
        }

        const mediaData = []

        if (files && files.length) {
            for (const file of files) {
                const mediaType = file.mimetype.startsWith("image/") ? "image" : "video"

                const result = await uploadToCloudinary(
                    file.buffer,
                    "srms/posts",
                    mediaType
                )

                mediaData.push({
                    mediaUrl: result.secure_url,
                    mediaType: mediaType.toUpperCase(),
                    publicId: result.public_id
                })
            }
        }

        const connection = await pool.getConnection()

        try {
            const postContent = content ?? null;
            await connection.beginTransaction()
            const postId = await PostRepository.createPost(connection, userId, postContent)

            await PostRepository.createPostMedia(connection, postId, mediaData)
            await connection.commit()
            return { postId };

        } catch (error) {
            await connection.rollback()
            throw error

        } finally {
            connection.release()
        }

    },
    async updatePost(userId, postId, content) {
        const post = await PostRepository.findPostById(postId)
        if (!post) {
            throw new AppError("post not found", 404)
        }
        if (post.user_id !== userId) {
            throw new AppError("You can only edit your own post", 403)
        }

        const result = await PostRepository.updatePostContent(postId, content)
        return result

    },

    async deletePost(userId, postId) {
        const post = await PostRepository.findPostById(postId)
        if (!post) {
            throw new AppError("post not found", 404)
        }
        if (post.user_id !== userId) {
            throw new AppError("You can only delete your own post", 403)
        }

        const postMedia = await PostRepository.findPostMedia(postId)


        for (const media of postMedia) {
            await deleteFromCloudinary(
                media.public_id,
                media.media_url.includes("/video/") ? "video" : "image"
            );
        }

        const connection = await pool.getConnection()
        try {
            await connection.beginTransaction()
            await PostRepository.updatePost(connection, postId)
            await PostRepository.deletePostMedia(connection, postId)
            await connection.commit()
        } catch (error) {
            await connection.rollback()
            throw error
        } finally {
            connection.release()
        }
    },

    async likePost(userId, postId) {
        const post = await PostRepository.findPostById(postId)
        if (post.status !== "ACTIVE" || post.deleted_at !== null) {
            throw new AppError("Post is not available", 400);
        }

        const isLike = await PostRepository.findLike(postId, userId)
        if (isLike) {
            throw new AppError("Already like", 409)
        }

        const result = await PostRepository.createLike(postId, userId)
        return result
    },
    async unlikePost(userId, postId) {
        const result = await PostRepository.deleteLike(postId, userId);

        if (!result) {
            throw new AppError("Like not found", 404);
        }

        return true;
    },

    async addComment(userId, postId, content) {
        const post = await PostRepository.findPostById(postId);

        if (!post) {
            throw new AppError("Post not found", 404);
        }

        if (post.status !== "ACTIVE" || post.deleted_at !== null) {
            throw new AppError("Post is not available", 400);
        }

        return await PostRepository.createComment(
            postId,
            userId,
            content
        );
    },

    async updateComment(userId, commentId, content) {
        const comment = await PostRepository.findCommentById(commentId);

        if (!comment) {
            throw new AppError("Comment not found", 404);
        }

        if (comment.user_id !== userId) {
            throw new AppError(
                "You can only edit your own comment",
                403
            );
        }

        return await PostRepository.updateComment(
            commentId,
            content
        );
    },

    async deleteComment(userId, commentId) {
        const comment = await PostRepository.findCommentById(commentId);

        if (!comment) {
            throw new AppError("Comment not found", 404);
        }

        if (comment.user_id !== userId) {
            throw new AppError(
                "You can only delete your own comment",
                403
            );
        }

        return await PostRepository.deleteComment(commentId);
    },

};

module.exports = PostService;