const catchAsync = require("../../utils/catchAsync");
const IntroService = require("./intro.service");

// who is acting always comes from the verified session, never from the request
const viewerOf = (req) => ({ userId: req.user.userId, role: req.user.role });

const IntroController = {

    paths: catchAsync(async (req, res) => {
        const data = await IntroService.getPaths(viewerOf(req), req.validatedQuery);
        return res.status(200).json({ success: true, data });
    }),

    create: catchAsync(async (req, res) => {
        const data = await IntroService.createIntro(viewerOf(req), req.body);
        return res.status(201).json({ success: true, message: "Introduction request sent", data });
    }),

    list: catchAsync(async (req, res) => {
        const data = await IntroService.listIntros(viewerOf(req), req.validatedQuery);
        return res.status(200).json({ success: true, data });
    }),

    get: catchAsync(async (req, res) => {
        const data = await IntroService.getIntro(viewerOf(req), req.params.id);
        return res.status(200).json({ success: true, data });
    }),

    respond: catchAsync(async (req, res) => {
        const data = await IntroService.respond(viewerOf(req), req.params.id, req.body);
        return res.status(200).json({ success: true, message: "Request updated", data });
    }),

    cancel: catchAsync(async (req, res) => {
        const data = await IntroService.cancel(viewerOf(req), req.params.id);
        return res.status(200).json({ success: true, message: "Request cancelled", data });
    }),

};

module.exports = IntroController;
