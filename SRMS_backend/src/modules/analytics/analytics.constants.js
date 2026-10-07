// Personal analytics: post impressions, profile views and search appearances.

// the periods a member can look at (days, counting today)
const RANGES = [7, 30, 90];
const DEFAULT_RANGE = 30;

// per (subject, viewer, day): repeat views count, but only up to these caps
const CAPS = {
    POST_VIEWS_PER_DAY: 5,
    PROFILE_VIEWS_PER_DAY: 20,
    SEARCH_APPEARANCES_PER_DAY: 20,
};

const MAX_IMPRESSIONS_PER_REQUEST = 50; // post ids one client report may carry
const TOP_LIMIT = 5; // rows in each "top companies / roles" list

// roles whose visits are never recorded (moderation is not an audience)
const UNTRACKED_VIEWER_ROLES = ["ADMIN"];

// shown next to the numbers so nobody has to guess what is being counted
const DEFINITIONS = {
    post_impressions: "Times your posts were shown on someone else's screen. The same person can count again on another visit (at most 5 times a day per post).",
    post_reach: "Different people who saw at least one of your posts.",
    engagements: "Likes and comments other people left on your posts.",
    engagement_rate: "Engagements divided by impressions.",
    profile_views: "Times someone else opened your profile.",
    profile_viewers: "Different people who opened your profile.",
    search_appearances: "Times your profile was listed in someone's search or filtered directory results.",
    searchers: "Different people whose search results included you.",
};

module.exports = { RANGES, DEFAULT_RANGE, CAPS, MAX_IMPRESSIONS_PER_REQUEST, TOP_LIMIT, UNTRACKED_VIEWER_ROLES, DEFINITIONS };
