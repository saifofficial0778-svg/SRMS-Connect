const express = require("express");
const IntroController = require("./intro.controller");
const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const { createIntroSchema, respondIntroSchema, introPathsSchema, listIntrosSchema } = require("./intro.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const { mentorshipWriteLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

// signed-in, ACTIVE users only; role, connections and who-is-who are checked in the service
router.use(verifyToken);

// fixed paths before "/:id"
router.get("/paths", validateQuery(introPathsSchema), IntroController.paths);

router.get("/", validateQuery(listIntrosSchema), IntroController.list);
router.post("/", mentorshipWriteLimiter, validate(createIntroSchema), IntroController.create);

router.get("/:id", IntroController.get);
router.patch("/:id/respond", mentorshipWriteLimiter, validate(respondIntroSchema), IntroController.respond);
router.patch("/:id/cancel", mentorshipWriteLimiter, IntroController.cancel);

module.exports = router;
