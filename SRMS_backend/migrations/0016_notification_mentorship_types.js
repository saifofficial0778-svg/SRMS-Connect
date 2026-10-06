// Adds notification types for mentorship and warm introductions. Widening an ENUM only appends
// values, so every existing notification row keeps its type unchanged.
//   MENTORSHIP_REQUEST  a student asked you to mentor them
//   MENTORSHIP_UPDATE   a mentorship you are in changed (accepted, declined, completed, new goal, session logged)
//   INTRO_REQUEST       a student asked you to introduce them to someone you both know
//   INTRO_UPDATE        an introduction was made / declined
const BEFORE =
    "'CONNECTION_REQUEST','CONNECTION_ACCEPTED','POST_LIKE','POST_COMMENT','NEW_MESSAGE','ACCOUNT_STATUS','JOB_POSTED','CAREER_REQUEST','CAREER_UPDATE'";
const ADDED = "'MENTORSHIP_REQUEST','MENTORSHIP_UPDATE','INTRO_REQUEST','INTRO_UPDATE'";

module.exports = {
    async up(conn) {
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE},${ADDED}) NOT NULL`);
    },
    async down(conn) {
        await conn.query(`DELETE FROM notifications WHERE type IN (${ADDED})`);
        await conn.query(`ALTER TABLE notifications MODIFY type ENUM(${BEFORE}) NOT NULL`);
    },
};
