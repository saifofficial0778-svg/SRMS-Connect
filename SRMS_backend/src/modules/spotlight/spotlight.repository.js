const pool = require("../../config/db");

// dates leave the database as the same "YYYY-MM-DDTHH:mm" text they came in as
const SELECT = `
    SELECT
        s.id, s.title, s.description, s.category, s.image_url, s.location, s.is_online,
        s.cta_label, s.cta_url, s.status,
        DATE_FORMAT(s.starts_at, '%Y-%m-%dT%H:%i') AS starts_at,
        DATE_FORMAT(s.ends_at, '%Y-%m-%dT%H:%i') AS ends_at,
        DATE_FORMAT(s.publish_at, '%Y-%m-%dT%H:%i') AS publish_at,
        s.created_at, s.updated_at,
        (s.status = 'PUBLISHED' AND s.publish_at IS NOT NULL AND s.publish_at > NOW()) AS is_scheduled,
        (COALESCE(s.ends_at, s.starts_at) IS NOT NULL AND COALESCE(s.ends_at, s.starts_at) < NOW()) AS is_over
    FROM campus_spotlights s`;

// What a member may see: published, its publish time has come, and it has not ended.
const VISIBLE = `
    s.status = 'PUBLISHED'
    AND (s.publish_at IS NULL OR s.publish_at <= NOW())
    AND (COALESCE(s.ends_at, s.starts_at) IS NULL OR COALESCE(s.ends_at, s.starts_at) >= NOW())`;

const toSqlDateTime = (value) => (value ? `${value.replace("T", " ")}:00` : null);
const DATE_COLUMNS = ["starts_at", "ends_at", "publish_at"];
const COLUMNS = ["title", "description", "category", "image_url", "starts_at", "ends_at", "location", "is_online", "cta_label", "cta_url", "status", "publish_at"];
const toColumnValue = (column, value) => (DATE_COLUMNS.includes(column) ? toSqlDateTime(value) : column === "is_online" ? (value ? 1 : 0) : value);

const SpotlightRepository = {

    // limit is a validated integer (execute() can't bind LIMIT placeholders)
    async findVisible(limit) {
        const [rows] = await pool.execute(
            `${SELECT} WHERE ${VISIBLE}
             ORDER BY (s.starts_at IS NULL) ASC, s.starts_at ASC, s.created_at DESC
             LIMIT ${limit}`
        );
        return rows;
    },

    async findAll({ status }, limit, offset) {
        const where = status ? "WHERE s.status = ?" : "";
        const [rows] = await pool.execute(
            `${SELECT} ${where} ORDER BY s.created_at DESC, s.id DESC LIMIT ${limit} OFFSET ${offset}`,
            status ? [status] : []
        );
        return rows;
    },

    async countAll({ status }) {
        const [[row]] = await pool.execute(
            `SELECT COUNT(*) AS c FROM campus_spotlights s ${status ? "WHERE s.status = ?" : ""}`,
            status ? [status] : []
        );
        return Number(row.c);
    },

    async countByStatus() {
        const [rows] = await pool.execute("SELECT status, COUNT(*) AS c FROM campus_spotlights GROUP BY status");
        return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)]));
    },

    async findById(id) {
        const [rows] = await pool.execute(`${SELECT} WHERE s.id = ? LIMIT 1`, [id]);
        return rows[0];
    },

    async create(adminId, data) {
        const [result] = await pool.execute(
            `INSERT INTO campus_spotlights (${COLUMNS.join(", ")}, created_by) VALUES (${COLUMNS.map(() => "?").join(", ")}, ?)`,
            [...COLUMNS.map((column) => toColumnValue(column, data[column])), adminId]
        );
        return result.insertId;
    },

    // only whitelisted columns can be written, whatever the caller passes
    async update(id, changes) {
        const columns = COLUMNS.filter((column) => changes[column] !== undefined);
        if (!columns.length) return 0;
        const [result] = await pool.execute(
            `UPDATE campus_spotlights SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
            [...columns.map((column) => toColumnValue(column, changes[column])), id]
        );
        return result.affectedRows;
    },

    async remove(id) {
        const [result] = await pool.execute("DELETE FROM campus_spotlights WHERE id = ?", [id]);
        return result.affectedRows;
    },
};

module.exports = SpotlightRepository;
