import authApi from "./api";
import { createAnalyticsClient } from "./analyticsClient";
import { createImpressionTracker } from "../utils/analyticsFormat";

export const { getOverview, getPostStats, getProfileViewers, recordImpressions, getMyPosts } = createAnalyticsClient(authApi);

// one tracker for the whole app: a post is reported at most once per page session
export const impressionTracker = createImpressionTracker({ send: recordImpressions });
