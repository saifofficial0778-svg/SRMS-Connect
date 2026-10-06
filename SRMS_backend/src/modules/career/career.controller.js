const catchAsync = require("../../utils/catchAsync");
const CareerService = require("./career.service");

// who is acting always comes from the verified session, never from the request
const viewerOf = (req) => ({ userId: req.user.userId, role: req.user.role });

const CareerController = {

    eligibleAlumni: catchAsync(async (req, res) => {
        const data = await CareerService.listEligibleAlumni(viewerOf(req), req.validatedQuery);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    create: catchAsync(async (req, res) => {
        const data = await CareerService.createRequest(viewerOf(req), req.body);

        return res.status(201).json({
            success: true,
            message: "Request sent",
            data
        });
    }),

    list: catchAsync(async (req, res) => {
        const data = await CareerService.listRequests(viewerOf(req), req.validatedQuery);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    get: catchAsync(async (req, res) => {
        const data = await CareerService.getRequest(viewerOf(req), req.params.id);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    respond: catchAsync(async (req, res) => {
        const data = await CareerService.respond(viewerOf(req), req.params.id, req.body);

        return res.status(200).json({
            success: true,
            message: "Request updated",
            data
        });
    }),

    cancel: catchAsync(async (req, res) => {
        const data = await CareerService.cancel(viewerOf(req), req.params.id);

        return res.status(200).json({
            success: true,
            message: "Request cancelled",
            data
        });
    }),

};

module.exports = CareerController;
