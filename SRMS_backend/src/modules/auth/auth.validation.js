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

    const loginSchema=z.object({
        enrollment: z.string().trim().min(1),
        password: z.string().min(8),
    })

    const forgotPasswordSchema=z.object({
        enrollment:z.string().trim().min(1)
    })

    const resetPasswordSchema=z.object({
        resetToken: z.string().min(1),
        newPassword:z.string().min(8)
    })

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};