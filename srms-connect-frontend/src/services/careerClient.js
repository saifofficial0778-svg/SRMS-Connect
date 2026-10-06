import { careerFiltersToApiParams, CAREER_PAGE_SIZE } from "../utils/careerFormat.js";

// Talks to /api/career. The HTTP client is injected so it can be tested without axios;
// careerService.js wires in the real authenticated instance.
export function createCareerClient(http) {
  // alumni the signed-in user may ask (their accepted connections), best matches first
  async function getEligibleAlumni(type, jobId) {
    const params = { type };
    if (jobId) params.job_id = jobId;
    const response = await http.get("/career/alumni", { params });
    const data = response.data?.data || {};
    return { alumni: data.alumni || [], job: data.job || null, canRequest: Boolean(data.can_request) };
  }

  async function listRequests(filters, page = 1, limit = CAREER_PAGE_SIZE) {
    const response = await http.get("/career/requests", { params: careerFiltersToApiParams(filters, page, limit) });
    const data = response.data?.data || {};
    const pagination = data.pagination || {};
    return {
      requests: data.requests || [],
      canRequest: Boolean(data.can_request),
      canRespond: Boolean(data.can_respond),
      pagination: {
        page: pagination.page || page,
        limit: pagination.limit || limit,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 1,
      },
    };
  }

  async function getRequest(id) {
    const response = await http.get(`/career/requests/${id}`);
    return response.data?.data;
  }

  async function createRequest(payload) {
    const response = await http.post("/career/requests", payload);
    return response.data?.data; // { id }
  }

  // action: ACCEPT | REJECT | ANSWER | COMPLETE
  async function respondToRequest(id, action, responseText) {
    const body = { action };
    const text = String(responseText || "").trim();
    if (text) body.response = text;
    const response = await http.patch(`/career/requests/${id}/respond`, body);
    return response.data?.data;
  }

  async function cancelRequest(id) {
    const response = await http.patch(`/career/requests/${id}/cancel`);
    return response.data?.data;
  }

  return { getEligibleAlumni, listRequests, getRequest, createRequest, respondToRequest, cancelRequest };
}
