const { z } = require("zod");

const registerSchema = z
    .object({
        enrollment: z.string().trim().min(1),
        dob: z.string().date(),
        password: z.string().min(8),
        confirmPassword: z.string().min(8),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

module.exports = {
    registerSchema,
};