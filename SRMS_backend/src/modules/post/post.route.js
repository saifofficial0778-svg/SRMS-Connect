const express = require("express");
const upload = require("../../middlewares/multerMiddleware");
const PostController = require("./post.controller");
const {validate}=require('../../middlewares/validationMiddleware')
const {createPostSchema,updatePostSchema}=require('./post.validation')
const verifyToken=require('../../middlewares/authMiddleware')

const router = express.Router();

router.post("/",verifyToken,upload.array("media", 5),validate(createPostSchema),PostController.createPost);

router.patch("/:postId",verifyToken,validate(updatePostSchema),PostController.updatePost);


module.exports = router;