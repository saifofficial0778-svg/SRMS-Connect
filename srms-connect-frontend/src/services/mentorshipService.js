import authApi from "./api";
import { createMentorshipClient } from "./mentorshipClient";

const client = createMentorshipClient(authApi);

export const {
  getMyMentorProfile, saveMentorProfile, listMentors, getMatches, getMentor,
  listMentorships, getMentorship, createMentorship, respondToMentorship, cancelMentorship, completeMentorship,
  addGoal, setGoalStatus, addSession,
  getIntroPaths, listIntros, getIntro, createIntro, respondToIntro, cancelIntro,
} = client;
