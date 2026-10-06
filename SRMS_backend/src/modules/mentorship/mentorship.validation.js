const { z } = require("zod");
const { TOPICS, STATUSES, LIMITS } = require("./mentorship.constants");

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const positiveId = z.number().int().positive();

const text = (min, max, label) =>
    z
        .string()
        .trim()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`);

const uniqueCaseInsensitive = (list) => new Set(list.map((v) => v.toLowerCase())).size === list.length;

// An alumnus's own mentor profile. Whose profile it is comes from the session, never the body.
const mentorProfileSchema = z
    .object({
        bio: text(20, 600, "Bio"),
        availability: text(3, 200, "Availability"),
        max_active_mentees: z.number().int().min(1).max(20),
        is_accepting: z.boolean().default(true),
        topics: z
            .array(z.enum(TOPICS))
            .min(1, "Choose at least one topic")
            .max(LIMITS.MAX_TOPICS)
            .refine((list) => new Set(list).size === list.length, "Duplicate topics"),
        // free-text tags such as "Computer Applications" or "final-year students"
        areas: z
            .array(z.string().trim().min(2).max(100))
            .max(LIMITS.MAX_AREAS)
            .refine(uniqueCaseInsensitive, "Duplicate areas")
            .default([]),
    })
    .strict();

// The mentee is always the signed-in user: there is no mentee/student field.
const createMentorshipSchema = z
    .object({
        mentor_id: positiveId,
        topic: z.enum(TOPICS),
        message: text(20, 1000, "Message"),
        goals: z.array(text(3, 200, "Goal")).max(LIMITS.INITIAL_GOALS).default([]),
    })
    .strict();

const respondSchema = z
    .object({
        action: z.enum(["ACCEPT", "REJECT"]),
        response: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()),
    })
    .strict();

const completeSchema = z
    .object({ note: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()) })
    .strict();

const goalSchema = z.object({ title: text(3, 200, "Goal") }).strict();
const goalStatusSchema = z.object({ status: z.enum(["OPEN", "DONE"]) }).strict();

const sessionSchema = z
    .object({
        // a session that already happened: today or earlier
        session_date: z
            .string()
            .date("Use a date like 2026-03-15")
            .refine((d) => d <= new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), "A session can't be logged for a future date"),
        duration_minutes: z.number().int().min(5).max(600).nullable().optional(),
        notes: text(5, 1000, "Notes"),
    })
    .strict();

const listMentorsSchema = z.object({
    q: z.preprocess(blankToUndefined, z.string().trim().min(2, "Search must be at least 2 characters").max(100).optional()),
    topic: z.preprocess(blankToUndefined, z.enum(TOPICS).optional()),
    skills: z.preprocess(
        blankToUndefined,
        z
            .string()
            .max(300)
            .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5))
            .optional()
    ),
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(12)),
});

// matching is always for the signed-in user; the only inputs are what they want help with
const matchQuerySchema = z
    .object({
        topic: z.preprocess(blankToUndefined, z.enum(TOPICS).optional()),
        skills: z.preprocess(
            blankToUndefined,
            z
                .string()
                .max(300)
                .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5))
                .optional()
        ),
    })
    .strict();

const listMentorshipsSchema = z.object({
    // mentee = mentorships where I am the student, mentor = where I am the mentor
    box: z.preprocess(blankToUndefined, z.enum(["mentee", "mentor"]).default("mentee")),
    status: z.preprocess(blankToUndefined, z.enum(STATUSES).optional()),
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
});

module.exports = {
    mentorProfileSchema,
    createMentorshipSchema,
    respondSchema,
    completeSchema,
    goalSchema,
    goalStatusSchema,
    sessionSchema,
    listMentorsSchema,
    matchQuerySchema,
    listMentorshipsSchema,
};
