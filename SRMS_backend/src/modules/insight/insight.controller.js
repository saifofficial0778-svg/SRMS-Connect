const catchAsync = require("../../utils/catchAsync");
const InsightService = require("./insight.service");

const InsightController = {

    industryPulse: catchAsync(async (req, res) => {
        const data = await InsightService.getIndustryPulse();

        return res.status(200).json({
            success: true,
            data
        });
    }),

    skillGap: catchAsync(async (req, res) => {
        // the viewer comes from the verified session; there is no way to ask for someone else's gap
        const viewer = { userId: req.user.userId, role: req.user.role };
        const data = await InsightService.getSkillGap(viewer, req.validatedQuery);

        return res.status(200).json({
            success: true,
            data
        });
    }),

};

module.exports = InsightController;
