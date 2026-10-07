const catchAsync = require("../../utils/catchAsync");
const SpotlightService = require("./spotlight.service");

// who is acting always comes from the verified session, never from the request
const viewerOf = (req) => ({ userId: req.user.userId, role: req.user.role });

const SpotlightController = {

    listVisible: catchAsync(async (req, res) => {
        const data = await SpotlightService.listVisible();
        return res.status(200).json({ success: true, data });
    }),

    listAll: catchAsync(async (req, res) => {
        const data = await SpotlightService.listAll(viewerOf(req), req.validatedQuery);
        return res.status(200).json({ success: true, data });
    }),

    create: catchAsync(async (req, res) => {
        const data = await SpotlightService.create(viewerOf(req), req.body);
        return res.status(201).json({ success: true, message: "Spotlight created", data });
    }),

    update: catchAsync(async (req, res) => {
        const data = await SpotlightService.update(viewerOf(req), req.params.id, req.body);
        return res.status(200).json({ success: true, message: "Spotlight updated", data });
    }),

    setStatus: catchAsync(async (req, res) => {
        const data = await SpotlightService.setStatus(viewerOf(req), req.params.id, req.body.status);
        return res.status(200).json({ success: true, message: "Spotlight updated", data });
    }),

    remove: catchAsync(async (req, res) => {
        await SpotlightService.remove(viewerOf(req), req.params.id);
        return res.status(200).json({ success: true, message: "Spotlight deleted" });
    }),
};

module.exports = SpotlightController;
