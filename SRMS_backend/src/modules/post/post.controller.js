const { success } = require("zod");
const catchAsync = require("../../utils/catchAsync");
const PostService = require('./post.service')

const PostController = {

    createPost: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { content } = req.body;

        const result = await PostService.createPost(
            userId,
            content,
            req.files
        );

        return res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: result
        });
    }),

    updatePost: catchAsync(async (req, res) => {
        const { postId } = req.params
        const { userId } = req.user;
        const { content } = req.body;

        const result = await PostService.updatePost(userId, postId, content)
        return res.status(200).json({
            success: true,
            message: "Post updated successfully",
            data: result
        })

    }),

    deletePost: catchAsync(async (req, res) => {
        const { postId } = req.params
        const { userId } = req.user

        const result = await PostService.deletePost(userId, postId)

        return res.status(200).json({
            success: true,
            message: "post deleted successfully"
        })
    }),

    likePost: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { postId } = req.params;

        const result = await PostService.likePost(userId, postId);

        return res.status(201).json({
            success: true,
            message: "Post liked successfully",
            data: result
        });
    }),

    unlikePost: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { postId } = req.params;

        await PostService.unlikePost(userId, postId);

        return res.status(200).json({
            success: true,
            message: "Post unliked successfully"
        });
    }),

    addComment: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { postId } = req.params;
        const { content } = req.body;

        const result = await PostService.addComment(
            userId,
            postId,
            content
        );

        return res.status(201).json({
            success: true,
            message: "Comment added successfully",
            data: result
        });
    }),

    updateComment: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { commentId } = req.params;
        const { content } = req.body;

        const result = await PostService.updateComment(
            userId,
            commentId,
            content
        );

        return res.status(200).json({
            success: true,
            message: "Comment updated successfully",
            data: result
        });
    }),

    deleteComment: catchAsync(async (req, res) => {
        const { userId } = req.user;
        const { commentId } = req.params;

        await PostService.deleteComment(
            userId,
            commentId
        );

        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully"
        });
    }),
};

module.exports = PostController;