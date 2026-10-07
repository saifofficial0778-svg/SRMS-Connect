const express = require("express");
const SpotlightController = require("./spotlight.controller");
const verifyToken = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/authorizeRole");
const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const { createSpotlightSchema, updateSpotlightSchema, setStatusSchema, adminListSchema } = require("./spotlight.validation");
const { adminWriteLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

router.use(verifyToken);

// every signed-in member: the cards that are live right now
router.get("/", SpotlightController.listVisible);

// admin console: everything, in every state
router.get("/manage", requireRole("ADMIN"), validateQuery(adminListSchema), SpotlightController.listAll);
router.post("/", requireRole("ADMIN"), adminWriteLimiter, validate(createSpotlightSchema), SpotlightController.create);
router.patch("/:id", requireRole("ADMIN"), adminWriteLimiter, validate(updateSpotlightSchema), SpotlightController.update);
router.patch("/:id/status", requireRole("ADMIN"), adminWriteLimiter, validate(setStatusSchema), SpotlightController.setStatus);
router.delete("/:id", requireRole("ADMIN"), adminWriteLimiter, SpotlightController.remove);

module.exports = router;
