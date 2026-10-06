const express = require("express");
const SearchController = require("./search.controller");
const { validateQuery } = require("../../middlewares/validationMiddleware");
const { searchQuerySchema } = require("./search.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const { searchLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

// signed-in users only, same as the public profile endpoint
router.use(verifyToken, searchLimiter);

router.get("/", validateQuery(searchQuerySchema), SearchController.search);

router.get("/filters", SearchController.getFilters);

module.exports = router;
