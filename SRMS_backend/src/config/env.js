// Central place for environment-driven settings that must not be hardcoded.

const DEV_DEFAULT_ORIGIN = "http://localhost:5173";

// CLIENT_ORIGIN may hold one origin or a comma-separated list.
// In production it is mandatory so a deploy can never silently fall back to localhost.
function getClientOrigins(env = process.env) {
    const raw = env.CLIENT_ORIGIN;
    if (raw && raw.trim()) {
        return raw
            .split(",")
            .map((o) => o.trim().replace(/\/+$/, ""))
            .filter(Boolean);
    }
    if (env.NODE_ENV === "production") {
        throw new Error("CLIENT_ORIGIN must be set when NODE_ENV=production");
    }
    return [DEV_DEFAULT_ORIGIN];
}

module.exports = { getClientOrigins };
