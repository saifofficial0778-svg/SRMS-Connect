import authApi from "./api";
import { createCareerClient } from "./careerClient";

export const { getEligibleAlumni, listRequests, getRequest, createRequest, respondToRequest, cancelRequest } =
  createCareerClient(authApi);
