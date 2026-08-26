const { success } = require("zod");
const catchAsync = require("../../utils/catchAsync");
const PostService=require('./post.service')

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

    updatePost:catchAsync(async(req,res)=>{
        const {postId}=req.params
        const { userId } = req.user;
        const { content } = req.body;
        
        const result=await PostService.updatePost(userId,postId,content)
        return res.status(200).json({
            success:true,
            message:"Post updated successfully",
            data:result
        })

    })
};

module.exports = PostController;