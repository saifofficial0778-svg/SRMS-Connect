const catchAsync = require("../../utils/catchAsync");
const JobService = require("./job.service");

// role comes from the verified session (auth middleware), never from the request
const viewerOf = (req) => ({ userId: req.user.userId, role: req.user.role });

const JobController = {

    list: catchAsync(async (req, res) => {
        const data = await JobService.listJobs(viewerOf(req), req.validatedQuery);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    get: catchAsync(async (req, res) => {
        const data = await JobService.getJob(viewerOf(req), req.params.id);

        return res.status(200).json({
            success: true,
            data
        });
    }),

    create: catchAsync(async (req, res) => {
        const data = await JobService.createJob(viewerOf(req), req.body);

        return res.status(201).json({
            success: true,
            message: "Job posted successfully",
            data
        });
    }),

    update: catchAsync(async (req, res) => {
        const data = await JobService.updateJob(viewerOf(req), req.params.id, req.body);

        return res.status(200).json({
            success: true,
            message: "Job updated successfully",
            data
        });
    }),

    setStatus: catchAsync(async (req, res) => {
        const data = await JobService.setStatus(viewerOf(req), req.params.id, req.body.status);

        return res.status(200).json({
            success: true,
            message: data.status === "CLOSED" ? "Job closed" : "Job reopened",
            data
        });
    }),

    remove: catchAsync(async (req, res) => {
        await JobService.deleteJob(viewerOf(req), req.params.id);

        return res.status(200).json({
            success: true,
            message: "Job deleted successfully"
        });
    }),

};

module.exports = JobController;
