const express = require("express");
const InsightController = require("./insight.controller");
const { validateQuery } = require("../../middlewares/validationMiddleware");
const { skillGapQuerySchema } = require("./insight.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const { analyticsLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

// signed-in users only, and rate limited: these are aggregate queries
router.use(verifyToken, analyticsLimiter);

router.get("/industry-pulse", InsightController.industryPulse);

router.get("/skill-gap", validateQuery(skillGapQuerySchema), InsightController.skillGap);

module.exports = router;
