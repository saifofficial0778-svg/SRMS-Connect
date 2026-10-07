const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const AppError = require("../utils/AppError");

const MINUTE = 60 * 1000;

// Keyed by IP + enrollment so one noisy user doesn't lock out a whole campus NAT,
// while a single account still can't be hammered from one address.
const keyByIpAndEnrollment = (req) => {
    const ip = ipKeyGenerator(req.ip);
    const enrollment = req.body && req.body.enrollment;
    return enrollment ? `${ip}:${String(enrollment).trim().toLowerCase()}` : ip;
};

const keyByIp = (req) => ipKeyGenerator(req.ip);

function createLimiter({ windowMs, max, message, keyGenerator = keyByIpAndEnrollment }) {
    return rateLimit({
        windowMs,
        limit: max,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        keyGenerator,
        skip: () => process.env.RATE_LIMIT_DISABLED === "true",
        handler: (req, res, next) => next(new AppError(message, 429)),
    });
}

// every /api/auth route, per IP
const authIpLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 100,
    keyGenerator: keyByIp,
    message: "Too many requests. Please try again later.",
});

// password login
const loginLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 10,
    message: "Too many login attempts. Please try again in 15 minutes.",
});

// anything that sends an OTP email: register resend, forgot-password, OTP login request
const otpSendLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 5,
    message: "Too many OTP requests. Please wait 15 minutes before trying again.",
});

// anything that checks an OTP
const otpVerifyLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 10,
    message: "Too many OTP attempts. Please wait 15 minutes before trying again.",
});

// directory / navbar search (typed-ahead, so the cap is generous)
const searchLimiter = createLimiter({
    windowMs: MINUTE,
    max: 60,
    keyGenerator: keyByIp,
    message: "Too many searches. Please slow down.",
});

// creating / editing / closing / deleting jobs: keyed by the signed-in user (runs after auth)
const jobWriteLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 30,
    keyGenerator: (req) => (req.user ? `user:${req.user.userId}` : keyByIp(req)),
    message: "Too many job changes. Please try again in a few minutes.",
});

// sending / answering / cancelling career-help requests: keyed by the signed-in user
const careerWriteLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 30,
    keyGenerator: (req) => (req.user ? `user:${req.user.userId}` : keyByIp(req)),
    message: "Too many requests. Please try again in a few minutes.",
});

// Industry Pulse / Skill Gap: aggregate queries, keyed by the signed-in user
const analyticsLimiter = createLimiter({
    windowMs: MINUTE,
    max: 30,
    keyGenerator: (req) => (req.user ? `user:${req.user.userId}` : keyByIp(req)),
    message: "Too many requests. Please try again in a minute.",
});

// "these posts were on my screen" reports from the feed (the client batches them)
const impressionLimiter = createLimiter({
    windowMs: MINUTE,
    max: 60,
    keyGenerator: (req) => (req.user ? `user:${req.user.userId}` : keyByIp(req)),
    message: "Too many requests. Please try again in a minute.",
});

// admin console changes (Campus Spotlight): keyed by the signed-in admin
const adminWriteLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 120,
    keyGenerator: (req) => (req.user ? `user:${req.user.userId}` : keyByIp(req)),
    message: "Too many changes. Please try again in a few minutes.",
});

// mentorship and warm-introduction changes: keyed by the signed-in user
const mentorshipWriteLimiter = createLimiter({
    windowMs: 15 * MINUTE,
    max: 40,
    keyGenerator: (req) => (req.user ? `user:${req.user.userId}` : keyByIp(req)),
    message: "Too many requests. Please try again in a few minutes.",
});

module.exports = {
    createLimiter,
    mentorshipWriteLimiter,
    impressionLimiter,
    adminWriteLimiter,
    analyticsLimiter,
    careerWriteLimiter,
    jobWriteLimiter,
    searchLimiter,
    keyByIpAndEnrollment,
    authIpLimiter,
    loginLimiter,
    otpSendLimiter,
    otpVerifyLimiter,
};
