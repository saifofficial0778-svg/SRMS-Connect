const { z } = require("zod");

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const positiveId = z.number().int().positive();

// The requester is always the signed-in user: there is no requester/student field.
const createIntroSchema = z
    .object({
        target_id: positiveId,
        introducer_id: positiveId,
        message: z
            .string()
            .trim()
            .min(20, "Please write at least 20 characters about why you'd like an introduction")
            .max(600, "Please keep it under 600 characters"),
    })
    .strict()
    .refine((d) => d.target_id !== d.introducer_id, { message: "Choose a different person to introduce you", path: ["introducer_id"] });

const respondIntroSchema = z
    .object({
        action: z.enum(["INTRODUCE", "DECLINE"]),
        note: z.preprocess(blankToUndefined, z.string().trim().max(600).optional()),
    })
    .strict();

const introPathsSchema = z.object({ target_id: z.coerce.number().int().positive() }).strict();

const listIntrosSchema = z.object({
    // sent = I asked for it, to_introduce = I was asked to introduce, received = I was introduced to someone
    box: z.preprocess(blankToUndefined, z.enum(["sent", "to_introduce", "received"]).default("sent")),
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
});

module.exports = { createIntroSchema, respondIntroSchema, introPathsSchema, listIntrosSchema };
