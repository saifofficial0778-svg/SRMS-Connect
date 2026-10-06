// Small helpers so migrations can be re-run safely (MySQL has no CREATE INDEX IF NOT EXISTS).

async function indexExists(conn, table, indexName) {
    const [rows] = await conn.query(
        `SELECT 1 FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
        [table, indexName]
    );
    return rows.length > 0;
}

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
        [table, column]
    );
    return rows.length > 0;
}

async function addIndex(conn, table, indexName, columnsSql, { unique = false } = {}) {
    if (await indexExists(conn, table, indexName)) return false;
    await conn.query(
        `ALTER TABLE \`${table}\` ADD ${unique ? "UNIQUE " : ""}INDEX \`${indexName}\` (${columnsSql})`
    );
    return true;
}

async function dropIndex(conn, table, indexName) {
    if (!(await indexExists(conn, table, indexName))) return false;
    await conn.query(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``);
    return true;
}

async function addColumn(conn, table, column, definitionSql) {
    if (await columnExists(conn, table, column)) return false;
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definitionSql}`);
    return true;
}

async function dropColumn(conn, table, column) {
    if (!(await columnExists(conn, table, column))) return false;
    await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    return true;
}

module.exports = { indexExists, columnExists, addIndex, dropIndex, addColumn, dropColumn };
