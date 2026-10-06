const catchAsync = require("../../utils/catchAsync");
const MentorshipService = require("./mentorship.service");

// who is acting always comes from the verified session, never from the request
const viewerOf = (req) => ({ userId: req.user.userId, role: req.user.role });

const ok = (res, data, message, status = 200) =>
    res.status(status).json(message ? { success: true, message, data } : { success: true, data });

const MentorshipController = {

    getMyMentorProfile: catchAsync(async (req, res) => ok(res, await MentorshipService.getMyMentorProfile(viewerOf(req)))),

    saveMentorProfile: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.saveMentorProfile(viewerOf(req), req.body), "Mentor profile saved")
    ),

    listMentors: catchAsync(async (req, res) => ok(res, await MentorshipService.listMentors(viewerOf(req), req.validatedQuery))),

    getMatches: catchAsync(async (req, res) => ok(res, await MentorshipService.getMatches(viewerOf(req), req.validatedQuery))),

    getMentor: catchAsync(async (req, res) => ok(res, await MentorshipService.getMentor(viewerOf(req), req.params.userId))),

    create: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.createMentorship(viewerOf(req), req.body), "Mentorship request sent", 201)
    ),

    list: catchAsync(async (req, res) => ok(res, await MentorshipService.listMentorships(viewerOf(req), req.validatedQuery))),

    get: catchAsync(async (req, res) => ok(res, await MentorshipService.getMentorship(viewerOf(req), req.params.id))),

    respond: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.respond(viewerOf(req), req.params.id, req.body), "Request updated")
    ),

    cancel: catchAsync(async (req, res) => ok(res, await MentorshipService.cancel(viewerOf(req), req.params.id), "Request cancelled")),

    complete: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.complete(viewerOf(req), req.params.id, req.body), "Mentorship completed")
    ),

    addGoal: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.addGoal(viewerOf(req), req.params.id, req.body), "Goal added", 201)
    ),

    setGoalStatus: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.setGoalStatus(viewerOf(req), req.params.id, req.params.goalId, req.body), "Goal updated")
    ),

    addSession: catchAsync(async (req, res) =>
        ok(res, await MentorshipService.addSession(viewerOf(req), req.params.id, req.body), "Session logged", 201)
    ),

};

module.exports = MentorshipController;
