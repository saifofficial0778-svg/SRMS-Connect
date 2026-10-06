const { z } = require("zod");

// A link a user supplies that other users will open (job application link, resume link).
// https only (blocks javascript:, data:, http:) and no embedded credentials.
const httpsUrl = (label, max = 500) =>
    z
        .string()
        .trim()
        .max(max)
        .url(`${label} must be a valid URL`)
        .refine((value) => {
            try {
                const u = new URL(value);
                return u.protocol === "https:" && !u.username && !u.password;
            } catch {
                return false;
            }
        }, `${label} must be a secure https:// URL`);

module.exports = { httpsUrl };
