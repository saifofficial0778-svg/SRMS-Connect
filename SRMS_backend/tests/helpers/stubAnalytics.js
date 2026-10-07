// Opening a profile and searching now record analytics as a side effect. Tests for those modules
// must not touch the real database, so they stub the recording methods with this helper.
const AnalyticsRepository = require("../../src/modules/analytics/analytics.repository");

module.exports = function stubAnalytics(mock) {
    return {
        recordImpressions: mock.method(AnalyticsRepository, "recordImpressions", async () => 1),
        recordProfileView: mock.method(AnalyticsRepository, "recordProfileView", async () => false),
        recordSearchAppearances: mock.method(AnalyticsRepository, "recordSearchAppearances", async () => 1),
    };
};
