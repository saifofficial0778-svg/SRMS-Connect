const SpotlightRepository = require("./spotlight.repository");
const AppError = require("../../utils/AppError");

const MEMBER_LIMIT = 6; // cards a member's home page can show
const ADMIN_ROLE = "ADMIN";

const parseId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw new AppError("Invalid spotlight id", 400);
    }
    return id;
};

// What every member sees. No status, schedule or author: a member only ever gets live cards.
function toPublicSpotlight(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        image_url: row.image_url,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        location: row.location,
        is_online: Boolean(row.is_online),
        cta_label: row.cta_label,
        cta_url: row.cta_url,
    };
}

// the admin console also needs the publishing state
function toAdminSpotlight(row) {
    return {
        ...toPublicSpotlight(row),
        status: row.status,
        publish_at: row.publish_at,
        is_scheduled: Boolean(row.is_scheduled),
        is_over: Boolean(row.is_over),
        // what a member's home page does with it right now
        is_live: row.status === "PUBLISHED" && !row.is_scheduled && !row.is_over,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// checked here as well as on the route, so no other caller can bypass the rule
const requireAdmin = (viewer) => {
    if (!viewer || viewer.role !== ADMIN_ROLE) {
        throw new AppError("Only an admin can manage Campus Spotlight", 403);
    }
};

async function loadOrFail(rawId) {
    const row = await SpotlightRepository.findById(parseId(rawId));
    if (!row) {
        throw new AppError("Spotlight not found", 404);
    }
    return row;
}

const SpotlightService = {

    // ---------- members ----------

    async listVisible() {
        const rows = await SpotlightRepository.findVisible(MEMBER_LIMIT);
        return { spotlights: rows.map(toPublicSpotlight) };
    },

    // ---------- admin ----------

    async listAll(viewer, { status, page, limit }) {
        requireAdmin(viewer);
        const [rows, total, counts] = await Promise.all([
            SpotlightRepository.findAll({ status }, limit, (page - 1) * limit),
            SpotlightRepository.countAll({ status }),
            SpotlightRepository.countByStatus(),
        ]);
        return {
            spotlights: rows.map(toAdminSpotlight),
            counts: { DRAFT: counts.DRAFT || 0, PUBLISHED: counts.PUBLISHED || 0, ARCHIVED: counts.ARCHIVED || 0 },
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    },

    async create(viewer, data) {
        requireAdmin(viewer);
        const id = await SpotlightRepository.create(viewer.userId, data);
        return toAdminSpotlight(await SpotlightRepository.findById(id));
    },

    async update(viewer, rawId, changes) {
        requireAdmin(viewer);
        const row = await loadOrFail(rawId);

        // the dates must still make sense after merging with what is already stored
        const startsAt = changes.starts_at !== undefined ? changes.starts_at : row.starts_at;
        const endsAt = changes.ends_at !== undefined ? changes.ends_at : row.ends_at;
        if (startsAt && endsAt && endsAt < startsAt) {
            throw new AppError("The end can't be before the start", 400);
        }
        const label = changes.cta_label !== undefined ? changes.cta_label : row.cta_label;
        const url = changes.cta_url !== undefined ? changes.cta_url : row.cta_url;
        if (Boolean(label) !== Boolean(url)) {
            throw new AppError("A button needs both a label and a link", 400);
        }

        await SpotlightRepository.update(row.id, changes);
        return toAdminSpotlight(await SpotlightRepository.findById(row.id));
    },

    // publish / unpublish (back to draft) / archive
    async setStatus(viewer, rawId, status) {
        requireAdmin(viewer);
        const row = await loadOrFail(rawId);
        if (row.status === status) {
            throw new AppError(`This spotlight is already ${status.toLowerCase()}`, 400);
        }
        await SpotlightRepository.update(row.id, { status });
        return toAdminSpotlight(await SpotlightRepository.findById(row.id));
    },

    async remove(viewer, rawId) {
        requireAdmin(viewer);
        const row = await loadOrFail(rawId);
        await SpotlightRepository.remove(row.id);
        return true;
    },
};

module.exports = SpotlightService;
module.exports.toPublicSpotlight = toPublicSpotlight;
module.exports.toAdminSpotlight = toAdminSpotlight;
