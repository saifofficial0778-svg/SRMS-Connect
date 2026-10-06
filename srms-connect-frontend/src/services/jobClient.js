import { jobFiltersToApiParams, JOBS_PAGE_SIZE } from "../utils/jobParams.js";

// Talks to /api/jobs. The HTTP client is injected so it can be tested without axios;
// jobService.js wires in the real authenticated instance.
export function createJobClient(http) {
  async function listJobs(filters, page = 1, limit = JOBS_PAGE_SIZE) {
    const response = await http.get("/jobs", { params: jobFiltersToApiParams(filters, page, limit) });
    const data = response.data?.data || {};
    const pagination = data.pagination || {};
    return {
      jobs: data.jobs || [],
      canPost: Boolean(data.can_post),
      pagination: {
        page: pagination.page || page,
        limit: pagination.limit || limit,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 1,
      },
    };
  }

  async function getJob(id) {
    const response = await http.get(`/jobs/${id}`);
    return response.data?.data;
  }

  async function createJob(payload) {
    const response = await http.post("/jobs", payload);
    return response.data?.data; // { id }
  }

  async function updateJob(id, payload) {
    const response = await http.patch(`/jobs/${id}`, payload);
    return response.data?.data;
  }

  async function setJobStatus(id, status) {
    const response = await http.patch(`/jobs/${id}/status`, { status });
    return response.data?.data;
  }

  async function deleteJob(id) {
    await http.delete(`/jobs/${id}`);
  }

  return { listJobs, getJob, createJob, updateJob, setJobStatus, deleteJob };
}
