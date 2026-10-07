const express = require("express");
const router = express.Router();

const ConnectionController = require("./connection.controller");
const verifyToken = require('../../middlewares/authMiddleware');

router.use(verifyToken);

router.post("/:userId/request", ConnectionController.sendRequest);

router.patch("/:id/accept", ConnectionController.acceptRequest);

router.patch("/:id/reject", ConnectionController.rejectRequest);

router.patch("/:id/cancel", ConnectionController.cancelRequest);

router.delete("/:id", ConnectionController.removeConnection);

router.get("/", ConnectionController.getMyConnections);

router.get("/requests/received", ConnectionController.getReceivedRequests);

router.get("/requests/sent", ConnectionController.getSentRequests);

// "People you may know" for the signed-in member
router.get("/suggestions", ConnectionController.getSuggestions);

// the people a member is connected with (suggestions under their profile)
router.get("/of/:userId", ConnectionController.getProfileConnections);

module.exports = router;