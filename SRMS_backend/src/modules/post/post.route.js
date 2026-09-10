const express = require("express");
const upload = require("../../middlewares/multerMiddleware");
const PostController = require("./post.controller");
const {validate,validateQuery}=require('../../middlewares/validationMiddleware')
const {createPostSchema,updatePostSchema,addCommentSchema,updateCommentSchema,feedQuerySchema}=require('./post.validation')
const verifyToken=require('../../middlewares/authMiddleware')

const router = express.Router();

router.post("/",verifyToken,upload.array("media", 5),validate(createPostSchema),PostController.createPost);

router.patch("/:postId",verifyToken,validate(updatePostSchema),PostController.updatePost);

router.delete('/:postId',verifyToken,PostController.deletePost)

router.post("/:postId/like",verifyToken,PostController.likePost);

router.delete("/:postId/like",verifyToken,PostController.unlikePost);

router.post("/:postId/comments",verifyToken,validate(addCommentSchema),PostController.addComment);

router.patch("/comments/:commentId",verifyToken,validate(updateCommentSchema),PostController.updateComment);

router.delete("/comments/:commentId",verifyToken,PostController.deleteComment);

router.get("/feed",verifyToken,validateQuery(feedQuerySchema),PostController.getFeed);

module.exports = router;