// Adds the PROFILE_VIEW notification type ("X viewed your profile"). Widening an ENUM only appends
// a value, so every existing notification row keeps its type unchanged.
const BEFORE =
    "'CONNECTION_REQUEST','CONNECTION_ACCEPTED','POST_LIKE','POST_COMMENT','NEW_MESSAGE','ACCOUNT_STATUS','JOB_POSTED','CAREER_REQUEST','CAREER_UPDATE','MENTORSHIP_REQUEST','MENTORSHIP_UPDATE','INTRO_REQUEST','INTRO_UPDATE'";
const ADDED = "'PROFILE_VIEW'";

module.exports = {
    async up(conn) {
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE},${ADDED}) NOT NULL`);
    },
    async down(conn) {
        await conn.query(`DELETE FROM notifications WHERE type IN (${ADDED})`);
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE}) NOT NULL`);
    },
};
