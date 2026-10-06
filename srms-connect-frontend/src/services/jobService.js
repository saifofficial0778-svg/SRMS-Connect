import authApi from "./api";
import { createJobClient } from "./jobClient";

export const { listJobs, getJob, createJob, updateJob, setJobStatus, deleteJob } = createJobClient(authApi);
