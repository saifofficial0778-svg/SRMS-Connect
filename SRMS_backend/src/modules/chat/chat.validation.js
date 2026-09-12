const { z } = require("zod");

const sendMessageSchema = z.object({
    content: z.string().trim().min(1).max(2000)
});

module.exports = {
    sendMessageSchema
};