import authApi from "./api";
import { createInsightClient } from "./insightClient";

export const { getIndustryPulse, getSkillGap } = createInsightClient(authApi);
