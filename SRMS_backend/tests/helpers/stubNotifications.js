// Other modules now call NotificationService as a side effect. Tests for those modules must not
// touch the real database, so they stub every side-effect method with this helper.
const NotificationService = require("../../src/modules/notification/notification.service");

const SIDE_EFFECT_METHODS = [
    "notifyConnectionRequest",
    "notifyConnectionAccepted",
    "notifyPostLike",
    "notifyPostComment",
    "notifyNewMessage",
    "notifyAccountActivated",
    "notifyJobPosted",
    "notifyEvent",
    "settleByKey",
    "removeByKey",
    "notifyCareerRequest",
    "notifyCareerUpdate",
    "markCareerRequestHandled",
    "removeCareerRequestNotification",
    "removeJobNotifications",
    "markConnectionRequestHandled",
    "removeConnectionRequest",
    "removePostNotifications",
    "removeCommentNotification",
    "markMessageNotificationsRead",
];

module.exports = function stubNotifications(mock) {
    const stubs = {};
    for (const name of SIDE_EFFECT_METHODS) {
        stubs[name] = mock.method(NotificationService, name, async () => {});
    }
    return stubs;
};
