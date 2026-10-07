const { z } = require("zod");
const { httpsUrl } = require("../../utils/httpsUrl");

const CATEGORIES = ["EVENT", "WORKSHOP", "PLACEMENT", "GUEST_LECTURE", "SEMINAR", "HACKATHON", "PROGRAM", "ANNOUNCEMENT"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

// "" (an emptied form field) means "none"; a field that was not sent at all stays untouched
const blankToNull = (v) => (typeof v === "string" && v.trim() === "" ? null : v);
const blankToUndefined = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// "2026-11-05T14:30" exactly as an <input type="datetime-local"> sends it: campus local time,
// stored as-is (no time zone conversion anywhere).
const localDateTime = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a date and time like 2026-11-05T14:30")
    .refine((v) => !Number.isNaN(new Date(`${v}:00`).getTime()), "That date does not exist");

const optional = (schema) => z.preprocess(blankToNull, schema.nullable());

const fields = {
    title: z.string().trim().min(4, "Title must be at least 4 characters").max(120),
    description: z.string().trim().min(10, "Description must be at least 10 characters").max(600),
    category: z.enum(CATEGORIES),
    // banners and links are opened by every member: https only, no embedded credentials
    image_url: optional(httpsUrl("Banner link")),
    starts_at: optional(localDateTime),
    ends_at: optional(localDateTime),
    location: optional(z.string().trim().min(2).max(150)),
    is_online: z.boolean(),
    cta_label: optional(z.string().trim().min(2).max(40)),
    cta_url: optional(httpsUrl("Button link")),
    status: z.enum(STATUSES),
    publish_at: optional(localDateTime),
};

const consistent = (d, ctx) => {
    if (d.starts_at && d.ends_at && d.ends_at < d.starts_at) {
        ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end can't be before the start" });
    }
    // a button needs both its text and its link
    if (d.cta_label !== undefined && d.cta_url !== undefined && Boolean(d.cta_label) !== Boolean(d.cta_url)) {
        ctx.addIssue({ code: "custom", path: [d.cta_label ? "cta_url" : "cta_label"], message: "A button needs both a label and a link" });
    }
};

// Who created it is always the signed-in admin: there is no author field, and .strict() rejects one.
const createSpotlightSchema = z
    .object({
        ...fields,
        category: fields.category.default("EVENT"),
        image_url: fields.image_url.default(null),
        starts_at: fields.starts_at.default(null),
        ends_at: fields.ends_at.default(null),
        location: fields.location.default(null),
        is_online: fields.is_online.default(false),
        cta_label: fields.cta_label.default(null),
        cta_url: fields.cta_url.default(null),
        status: fields.status.default("DRAFT"),
        publish_at: fields.publish_at.default(null),
    })
    .strict()
    .superRefine(consistent);

const updateSpotlightSchema = z
    .object(fields)
    .partial()
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" })
    .superRefine(consistent);

const setStatusSchema = z.object({ status: z.enum(STATUSES) }).strict();

const adminListSchema = z
    .object({
        status: z.preprocess(blankToUndefined, z.enum(STATUSES).optional()),
        page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
        limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(20)),
    })
    .strict();

module.exports = { CATEGORIES, STATUSES, createSpotlightSchema, updateSpotlightSchema, setStatusSchema, adminListSchema };
