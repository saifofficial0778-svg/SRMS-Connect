const { z } = require("zod");
const { RANGES, DEFAULT_RANGE, MAX_IMPRESSIONS_PER_REQUEST } = require("./analytics.constants");

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const days = z.preprocess(
    blankToUndefined,
    z.coerce
        .number()
        .refine((n) => RANGES.includes(n), `Choose one of: ${RANGES.join(", ")} days`)
        .default(DEFAULT_RANGE)
);
const page = z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1));
const limit = z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(10));

// Posts the client actually showed on screen. Who saw them is always the signed-in user:
// there is no viewer field, and .strict() rejects an attempt to send one.
const recordImpressionsSchema = z
    .object({
        post_ids: z
            .array(z.number().int().positive())
            .min(1)
            .max(MAX_IMPRESSIONS_PER_REQUEST)
            .transform((ids) => [...new Set(ids)]),
    })
    .strict();

// whose analytics is never a parameter: it is always the signed-in user's own
const overviewQuerySchema = z.object({ days }).strict();

const postsQuerySchema = z
    .object({
        days,
        sort: z.preprocess(blankToUndefined, z.enum(["recent", "impressions"]).default("recent")),
        page,
        limit,
    })
    .strict();

const viewersQuerySchema = z.object({ days, page, limit }).strict();

module.exports = { recordImpressionsSchema, overviewQuerySchema, postsQuerySchema, viewersQuerySchema };
