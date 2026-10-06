// Adds the career-help notification types. Widening an ENUM only appends values, so every
// existing notification row keeps its type unchanged.
//   CAREER_REQUEST  someone asked you for a referral / resume review / answer
//   CAREER_UPDATE   a request you are part of changed status (accepted, rejected, answered, ...)
const BEFORE = "'CONNECTION_REQUEST','CONNECTION_ACCEPTED','POST_LIKE','POST_COMMENT','NEW_MESSAGE','ACCOUNT_STATUS','JOB_POSTED'";

module.exports = {
    async up(conn) {
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE},'CAREER_REQUEST','CAREER_UPDATE') NOT NULL`);
    },
    async down(conn) {
        await conn.query("DELETE FROM notifications WHERE type IN ('CAREER_REQUEST','CAREER_UPDATE')");
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE}) NOT NULL`);
    },
};
