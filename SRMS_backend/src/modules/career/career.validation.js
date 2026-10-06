const { z } = require("zod");
const { httpsUrl } = require("../../utils/httpsUrl");
const { REQUEST_TYPES, STATUSES, MESSAGE_LIMITS } = require("./career.constants");

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const positiveId = z.number().int().positive();

// The requester is always the signed-in user: there is deliberately no requester/student field,
// and .strict() rejects any attempt to send one.
const createRequestSchema = z
    .object({
        type: z.enum(REQUEST_TYPES),
        alumni_id: positiveId,
        job_id: positiveId.optional(),
        message: z.string().trim().max(1000),
        resume_url: httpsUrl("Resume link").optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
        const [min, max] = MESSAGE_LIMITS[data.type];
        if (data.message.length < min) {
            ctx.addIssue({ code: "custom", path: ["message"], message: `Please write at least ${min} characters` });
        } else if (data.message.length > max) {
            ctx.addIssue({ code: "custom", path: ["message"], message: `Please keep it under ${max} characters` });
        }

        if (data.type === "REFERRAL" && data.job_id === undefined) {
            ctx.addIssue({ code: "custom", path: ["job_id"], message: "A referral request must be for a specific job" });
        }
        if (data.type !== "REFERRAL" && data.job_id !== undefined) {
            ctx.addIssue({ code: "custom", path: ["job_id"], message: "Only referral requests are linked to a job" });
        }

        if (data.type === "RESUME_REVIEW" && !data.resume_url) {
            ctx.addIssue({ code: "custom", path: ["resume_url"], message: "Add a link to your resume" });
        }
        if (data.type === "QUESTION" && data.resume_url) {
            ctx.addIssue({ code: "custom", path: ["resume_url"], message: "A question doesn't take a resume link" });
        }
    });

// which actions are valid for which request type/status is decided by the service
const respondSchema = z
    .object({
        action: z.enum(["ACCEPT", "REJECT", "ANSWER", "COMPLETE"]),
        response: z.preprocess(blankToUndefined, z.string().trim().max(2000).optional()),
    })
    .strict();

const listRequestsSchema = z.object({
    // sent = requests I made, received = requests made to me
    box: z.preprocess(blankToUndefined, z.enum(["sent", "received"]).default("sent")),
    type: z.preprocess(blankToUndefined, z.enum(REQUEST_TYPES).optional()),
    status: z.preprocess(blankToUndefined, z.enum(STATUSES).optional()),
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(10)),
});

const eligibleAlumniSchema = z
    .object({
        type: z.enum(REQUEST_TYPES),
        job_id: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
    })
    .refine((d) => d.type !== "REFERRAL" || d.job_id !== undefined, {
        message: "job_id is required for referrals",
        path: ["job_id"],
    });

module.exports = { createRequestSchema, respondSchema, listRequestsSchema, eligibleAlumniSchema };
