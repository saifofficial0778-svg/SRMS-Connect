const PostRepository = require("./post.repository");
const AppError = require("../../utils/AppError");
const pool = require("../../config/db");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");

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
        const post=await PostRepository.findPostById(postId)
        if(!post){
            throw new AppError("post not found",404)
        }
        if(post.user_id!==userId){
            throw new AppError("You can only edit your own post",403)
        }

        const result=await PostRepository.updatePostContent(postId,content)
        return result
        
    },

};

module.exports = PostService;