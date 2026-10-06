const { z } = require("zod");
const { httpsUrl } = require("../../utils/httpsUrl");

const JOB_TYPES = ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "FREELANCE"];
const MAX_SKILLS = 10;

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const text = (min, max, label) =>
    z
        .string()
        .trim()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`);

// letters/numbers plus the punctuation real skill names use (C++, C#, Node.js, CI/CD, R&D)
const skill = z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[\p{L}\p{N} .+#&/_-]+$/u, "Skills can only contain letters, numbers and . + # & / _ -");

// Applications happen on the poster's own site, so the link is the one thing that must be trustworthy:
// https only (blocks javascript:, data:, http:), no embedded credentials.
const applyUrl = httpsUrl("Application link");

const dedupeSkills = (list) => {
    const seen = new Set();
    return list.filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const fields = {
    title: text(3, 150, "Title"),
    company: text(2, 150, "Company"),
    location: text(2, 150, "Location"),
    job_type: z.enum(JOB_TYPES),
    experience_min: z.number().int().min(0).max(40),
    experience_max: z.number().int().min(0).max(40).nullable(),
    description: text(20, 5000, "Description"),
    skills: z.array(skill).max(MAX_SKILLS, `At most ${MAX_SKILLS} skills`).transform(dedupeSkills),
    apply_url: applyUrl,
};

const experienceRange = (d) =>
    d.experience_min === undefined ||
    d.experience_max === undefined ||
    d.experience_max === null ||
    d.experience_max >= d.experience_min;
const experienceError = { message: "Maximum experience can't be lower than minimum", path: ["experience_max"] };

const createJobSchema = z
    .object({
        ...fields,
        experience_min: fields.experience_min.default(0),
        experience_max: fields.experience_max.default(null),
        skills: fields.skills.default([]),
    })
    .strict()
    .refine(experienceRange, experienceError);

// every field optional, but at least one must be sent
const updateJobSchema = z
    .object(fields)
    .partial()
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" })
    .refine(experienceRange, experienceError);

const updateJobStatusSchema = z.object({ status: z.enum(["OPEN", "CLOSED"]) }).strict();

const listJobsSchema = z.object({
    q: z.preprocess(blankToUndefined, z.string().trim().min(2, "Search must be at least 2 characters").max(100).optional()),
    company: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    location: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    job_type: z.preprocess(blankToUndefined, z.enum(JOB_TYPES).optional()),
    // years of experience the candidate has: matches jobs whose range includes it
    experience: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(40).optional()),
    skills: z.preprocess(
        blankToUndefined,
        z
            .string()
            .max(300)
            .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5))
            .optional()
    ),
    // the signed-in user's own jobs (including closed ones)
    mine: z.preprocess(blankToUndefined, z.enum(["true", "false"]).default("false").transform((v) => v === "true")),
    status: z.preprocess(blankToUndefined, z.enum(["OPEN", "CLOSED"]).optional()),
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
});

module.exports = { JOB_TYPES, MAX_SKILLS, createJobSchema, updateJobSchema, updateJobStatusSchema, listJobsSchema };
