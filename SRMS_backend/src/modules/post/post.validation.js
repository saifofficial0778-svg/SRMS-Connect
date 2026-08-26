const { z } = require("zod");

const createPostSchema = z.object({
    content: z.string().trim().max(5000).optional()
});

const updatePostSchema = z.object({
    content: z.string().trim().min(1).max(5000)
});
module.exports = {
    createPostSchema,
    updatePostSchema
};