const express = require("express");
const JobController = require("./job.controller");
const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const { createJobSchema, updateJobSchema, updateJobStatusSchema, listJobsSchema } = require("./job.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/authorizeRole");
const { jobWriteLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

router.use(verifyToken);

// any signed-in user can browse
router.get("/", validateQuery(listJobsSchema), JobController.list);
router.get("/:id", JobController.get);

// only ACTIVE alumni can post (verifyToken already guarantees ACTIVE); role is checked before
// the body is even validated
router.post("/", jobWriteLimiter, requireRole("ALUMNI"), validate(createJobSchema), JobController.create);

// ownership is enforced in the service (poster_id must match the signed-in user)
router.patch("/:id", jobWriteLimiter, validate(updateJobSchema), JobController.update);
router.patch("/:id/status", jobWriteLimiter, validate(updateJobStatusSchema), JobController.setStatus);
router.delete("/:id", jobWriteLimiter, JobController.remove);

module.exports = router;
