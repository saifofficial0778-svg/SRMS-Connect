const express = require("express");
const AnalyticsController = require("./analytics.controller");
const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const { recordImpressionsSchema, overviewQuerySchema, postsQuerySchema, viewersQuerySchema } = require("./analytics.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const { analyticsLimiter, impressionLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

router.use(verifyToken);

// posts the signed-in user's screen actually showed (batched by the client)
router.post("/impressions", impressionLimiter, validate(recordImpressionsSchema), AnalyticsController.recordImpressions);

// everything below is the signed-in user's OWN analytics: there is no user id in any of these URLs
router.get("/overview", analyticsLimiter, validateQuery(overviewQuerySchema), AnalyticsController.overview);
router.get("/posts", analyticsLimiter, validateQuery(postsQuerySchema), AnalyticsController.posts);
router.get("/profile-viewers", analyticsLimiter, validateQuery(viewersQuerySchema), AnalyticsController.profileViewers);

module.exports = router;
