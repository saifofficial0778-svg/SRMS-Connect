// Adds the JOB_POSTED notification type. Widening an ENUM only appends a value, so every
// existing notification row keeps its type unchanged.
const BEFORE = "'CONNECTION_REQUEST','CONNECTION_ACCEPTED','POST_LIKE','POST_COMMENT','NEW_MESSAGE','ACCOUNT_STATUS'";

module.exports = {
    async up(conn) {
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE},'JOB_POSTED') NOT NULL`);
    },
    // refuses to shrink the enum while JOB_POSTED rows exist (MySQL would error); delete them first
    async down(conn) {
        await conn.query("DELETE FROM notifications WHERE type = 'JOB_POSTED'");
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE}) NOT NULL`);
    },
};
