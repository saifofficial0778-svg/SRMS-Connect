const { z } = require("zod");

const getUsersSchema = z.object({
    role: z.enum(["STUDENT", "ALUMNI"]).optional(),
    status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = {
    getUsersSchema,
};