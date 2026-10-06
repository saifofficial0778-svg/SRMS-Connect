const { z } = require("zod");
const { OPEN_TO_INTENTS } = require("../profile/profile.constants");

// "" (an empty form field / ?company=) means "not provided", not "invalid"
const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalText = (max = 100) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const searchQuerySchema = z
    .object({
        // free text: name, company, designation or skill
        q: z.preprocess(
            blankToUndefined,
            z.string().trim().min(2, "Search must be at least 2 characters").max(100).optional()
        ),
        type: z.enum(["all", "people", "posts"]).default("all"),

        role: z.preprocess(blankToUndefined, z.enum(["STUDENT", "ALUMNI"]).optional()),
        company: optionalText(100),
        designation: optionalText(100),
        branch: optionalText(100),
        openTo: z.preprocess(blankToUndefined, z.enum(OPEN_TO_INTENTS).optional()),
        batch: z.preprocess(blankToUndefined, z.coerce.number().int().min(1950).max(2100).optional()),
        // comma separated, all must match, at most 5
        skills: z.preprocess(
            blankToUndefined,
            z
                .string()
                .max(300)
                .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5))
                .optional()
        ),

        page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
        limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).optional()),
    })
    // the directory (type=people) may browse with no text; global search needs something to search for
    .refine((d) => d.type === "people" || !!d.q, {
        message: "Search query is required",
        path: ["q"],
    });

module.exports = { searchQuerySchema };
