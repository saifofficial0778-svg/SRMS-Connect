const catchAsync = require("../../utils/catchAsync");
const AnalyticsService = require("./analytics.service");

// who is asking always comes from the verified session, never from the request
const viewerOf = (req) => ({ userId: req.user.userId, role: req.user.role });

const AnalyticsController = {

    recordImpressions: catchAsync(async (req, res) => {
        const data = await AnalyticsService.recordImpressions(viewerOf(req), req.body.post_ids);
        return res.status(200).json({ success: true, data });
    }),

    overview: catchAsync(async (req, res) => {
        const data = await AnalyticsService.getOverview(viewerOf(req), req.validatedQuery);
        return res.status(200).json({ success: true, data });
    }),

    posts: catchAsync(async (req, res) => {
        const data = await AnalyticsService.getPostStats(viewerOf(req), req.validatedQuery);
        return res.status(200).json({ success: true, data });
    }),

    profileViewers: catchAsync(async (req, res) => {
        const data = await AnalyticsService.getProfileViewers(viewerOf(req), req.validatedQuery);
        return res.status(200).json({ success: true, data });
    }),
};

module.exports = AnalyticsController;
