const express = require("express");
const C = require("./mentorship.controller");
const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const V = require("./mentorship.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const { mentorshipWriteLimiter: writeLimit, analyticsLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

// Everything needs a signed-in, ACTIVE user. Who may do what (role, being a participant, being the
// mentor vs the mentee) is decided in the service from the session - never from what the client sends.
router.use(verifyToken);

// an alumnus's own mentor profile
router.get("/mentor-profile", C.getMyMentorProfile);
router.put("/mentor-profile", writeLimit, validate(V.mentorProfileSchema), C.saveMentorProfile);

// discovery
router.get("/mentors", validateQuery(V.listMentorsSchema), C.listMentors);
router.get("/matches", analyticsLimiter, validateQuery(V.matchQuerySchema), C.getMatches);
router.get("/mentors/:userId", C.getMentor);

// the mentorship flow
router.get("/requests", validateQuery(V.listMentorshipsSchema), C.list);
router.post("/requests", writeLimit, validate(V.createMentorshipSchema), C.create);
router.get("/requests/:id", C.get);
router.patch("/requests/:id/respond", writeLimit, validate(V.respondSchema), C.respond);
router.patch("/requests/:id/cancel", writeLimit, C.cancel);
router.patch("/requests/:id/complete", writeLimit, validate(V.completeSchema), C.complete);

// goals and sessions inside an active mentorship
router.post("/requests/:id/goals", writeLimit, validate(V.goalSchema), C.addGoal);
router.patch("/requests/:id/goals/:goalId", writeLimit, validate(V.goalStatusSchema), C.setGoalStatus);
router.post("/requests/:id/sessions", writeLimit, validate(V.sessionSchema), C.addSession);

module.exports = router;
