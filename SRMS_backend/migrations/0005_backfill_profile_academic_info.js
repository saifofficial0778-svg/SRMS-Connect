// profiles.branch / profiles.batch_year exist but were never filled in, so directory filters
// would match nothing. The institution's own master records already hold this data, so copy it
// across - only into columns that are still NULL (nothing a user entered is overwritten).
//   students -> branch, admission_year      alumni -> branch, passout_year
//
// down() is intentionally a no-op: after the backfill there is no way to tell which values were
// copied and which were set later, and removing them would only lose data.

module.exports = {
    async up(conn) {
        const [students] = await conn.query(`
            UPDATE profiles p
            JOIN users u ON u.id = p.user_id
            JOIN student_master sm ON sm.enrollment = u.enrollment
            SET p.branch = COALESCE(p.branch, sm.branch),
                p.batch_year = COALESCE(p.batch_year, sm.admission_year)
            WHERE u.role = 'STUDENT' AND (p.branch IS NULL OR p.batch_year IS NULL)
        `);
        const [alumni] = await conn.query(`
            UPDATE profiles p
            JOIN users u ON u.id = p.user_id
            JOIN alumni_master am ON am.enrollment = u.enrollment
            SET p.branch = COALESCE(p.branch, am.branch),
                p.batch_year = COALESCE(p.batch_year, am.passout_year)
            WHERE u.role = 'ALUMNI' AND (p.branch IS NULL OR p.batch_year IS NULL)
        `);
        console.log(`   backfilled ${students.affectedRows} student and ${alumni.affectedRows} alumni profiles`);
    },
    async down() {
        console.log("   no-op (backfilled values are kept)");
    },
};
