const express = require("express");
const CareerController = require("./career.controller");
const { validate, validateQuery } = require("../../middlewares/validationMiddleware");
const { createRequestSchema, respondSchema, listRequestsSchema, eligibleAlumniSchema } = require("./career.validation");
const verifyToken = require("../../middlewares/authMiddleware");
const { careerWriteLimiter } = require("../../middlewares/rateLimiter");

const router = express.Router();

// everything here needs a signed-in, ACTIVE user; who may do what is decided in the service
// from the session (role, ownership, connection), never from anything the client sends
router.use(verifyToken);

router.get("/alumni", validateQuery(eligibleAlumniSchema), CareerController.eligibleAlumni);

router.get("/requests", validateQuery(listRequestsSchema), CareerController.list);
router.post("/requests", careerWriteLimiter, validate(createRequestSchema), CareerController.create);

router.get("/requests/:id", CareerController.get);
router.patch("/requests/:id/respond", careerWriteLimiter, validate(respondSchema), CareerController.respond);
router.patch("/requests/:id/cancel", careerWriteLimiter, CareerController.cancel);

module.exports = router;
