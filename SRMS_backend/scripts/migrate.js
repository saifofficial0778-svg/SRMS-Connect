// Minimal, dependency-free migration runner.
//   node scripts/migrate.js up       apply all pending migrations
//   node scripts/migrate.js status   list applied / pending
//   node scripts/migrate.js down     revert the most recently applied migration
//
// Migrations live in /migrations as NNNN_name.js exporting { up(conn), down?(conn) }.
// Applied names are recorded in the schema_migrations table.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

function listMigrations() {
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => /^\d{4}_.+\.js$/.test(f))
        .sort();
}

async function connect() {
    return mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT, 10),
        connectTimeout: 20000,
    });
}

async function ensureTable(conn) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(255) NOT NULL PRIMARY KEY,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);
}

async function appliedSet(conn) {
    const [rows] = await conn.query("SELECT name FROM schema_migrations");
    return new Set(rows.map((r) => r.name));
}

async function up(conn) {
    const applied = await appliedSet(conn);
    const pending = listMigrations().filter((f) => !applied.has(f));
    if (!pending.length) return console.log("Nothing to migrate.");

    for (const file of pending) {
        const migration = require(path.join(MIGRATIONS_DIR, file));
        console.log(`-> applying ${file}`);
        await migration.up(conn);
        await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
        console.log(`   done ${file}`);
    }
}

async function down(conn) {
    const [rows] = await conn.query("SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1");
    if (!rows.length) return console.log("No applied migrations.");
    const file = rows[0].name;
    const migration = require(path.join(MIGRATIONS_DIR, file));
    if (typeof migration.down !== "function") {
        throw new Error(`${file} has no down(); refusing to revert.`);
    }
    console.log(`<- reverting ${file}`);
    await migration.down(conn);
    await conn.query("DELETE FROM schema_migrations WHERE name = ?", [file]);
}

async function status(conn) {
    const applied = await appliedSet(conn);
    for (const f of listMigrations()) console.log(`${applied.has(f) ? "[applied]" : "[pending]"} ${f}`);
}

(async () => {
    const command = process.argv[2] || "status";
    const commands = { up, down, status };
    if (!commands[command]) {
        console.error("Usage: node scripts/migrate.js <up|down|status>");
        process.exit(1);
    }
    const conn = await connect();
    try {
        await ensureTable(conn);
        await commands[command](conn);
    } finally {
        await conn.end();
    }
})().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
});
