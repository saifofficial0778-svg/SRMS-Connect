const { z } = require("zod");
const { JOB_TYPES } = require("../job/job.validation");

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// whose skills are compared is never a parameter: it is always the signed-in user
const skillGapQuerySchema = z
    .object({
        job_type: z.preprocess(blankToUndefined, z.enum(JOB_TYPES).optional()),
        // matches job titles, e.g. "backend" or "data analyst"
        role: z.preprocess(blankToUndefined, z.string().trim().min(2, "Role must be at least 2 characters").max(100).optional()),
    })
    .strict();

module.exports = { skillGapQuerySchema };
