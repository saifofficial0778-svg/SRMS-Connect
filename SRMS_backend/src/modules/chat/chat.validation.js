const { z } = require("zod");

const sendMessageSchema = z.object({
    content: z.string().trim().min(1).max(2000)
});


const messageQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30)
});

module.exports = {
    sendMessageSchema,
    messageQuerySchema
};
