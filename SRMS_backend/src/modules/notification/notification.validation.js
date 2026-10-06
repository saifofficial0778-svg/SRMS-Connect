const { z } = require("zod");

const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const listNotificationsSchema = z.object({
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(20)),
    unreadOnly: z.preprocess(
        blankToUndefined,
        z.enum(["true", "false"]).default("false").transform((v) => v === "true")
    ),
});

module.exports = { listNotificationsSchema };
