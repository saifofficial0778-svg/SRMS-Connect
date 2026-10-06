import { matchParams, mentorFiltersToApiParams, MENTORS_PAGE_SIZE } from "../utils/mentorshipFormat.js";

const pageOf = (pagination, page, limit) => ({
  page: pagination?.page || page,
  limit: pagination?.limit || limit,
  total: pagination?.total || 0,
  totalPages: pagination?.totalPages || 1,
});

// Talks to /api/mentorship and /api/intros. The HTTP client is injected so it can be tested
// without axios; mentorshipService.js wires in the real authenticated instance.
// Who is acting is never sent: the server always takes it from the session.
export function createMentorshipClient(http) {
  const data = (response) => response.data?.data;

  // ---------- mentor profile (alumni) ----------
  async function getMyMentorProfile() {
    const d = data(await http.get("/mentorship/mentor-profile")) || {};
    return { canBeMentor: Boolean(d.can_be_mentor), mentor: d.mentor || null };
  }
  async function saveMentorProfile(payload) {
    const d = data(await http.put("/mentorship/mentor-profile", payload)) || {};
    return { canBeMentor: Boolean(d.can_be_mentor), mentor: d.mentor || null };
  }

  // ---------- discovery ----------
  async function listMentors(filters, page = 1, limit = MENTORS_PAGE_SIZE) {
    const d = data(await http.get("/mentorship/mentors", { params: mentorFiltersToApiParams(filters, page, limit) })) || {};
    return {
      mentors: d.mentors || [],
      canRequest: Boolean(d.can_request),
      canBeMentor: Boolean(d.can_be_mentor),
      pagination: pageOf(d.pagination, page, limit),
    };
  }
  async function getMatches(filters) {
    const d = data(await http.get("/mentorship/matches", { params: matchParams(filters) })) || {};
    return { matches: d.matches || [], criteria: d.criteria || null, mentorsConsidered: d.mentors_considered || 0, canRequest: Boolean(d.can_request) };
  }
  async function getMentor(userId) {
    return data(await http.get(`/mentorship/mentors/${userId}`));
  }

  // ---------- mentorships ----------
  async function listMentorships({ box = "mentee", status = "" } = {}, page = 1, limit = 10) {
    const params = { box, page, limit };
    if (status) params.status = status;
    const d = data(await http.get("/mentorship/requests", { params })) || {};
    return {
      mentorships: d.mentorships || [],
      canRequest: Boolean(d.can_request),
      canBeMentor: Boolean(d.can_be_mentor),
      pagination: pageOf(d.pagination, page, limit),
    };
  }
  const getMentorship = async (id) => data(await http.get(`/mentorship/requests/${id}`));
  const createMentorship = async (payload) => data(await http.post("/mentorship/requests", payload));

  // action: ACCEPT | REJECT
  async function respondToMentorship(id, action, note) {
    const body = { action };
    if (String(note || "").trim()) body.response = String(note).trim();
    return data(await http.patch(`/mentorship/requests/${id}/respond`, body));
  }
  const cancelMentorship = async (id) => data(await http.patch(`/mentorship/requests/${id}/cancel`));
  async function completeMentorship(id, note) {
    const body = {};
    if (String(note || "").trim()) body.note = String(note).trim();
    return data(await http.patch(`/mentorship/requests/${id}/complete`, body));
  }

  const addGoal = async (id, title) => data(await http.post(`/mentorship/requests/${id}/goals`, { title: String(title).trim() }));
  const setGoalStatus = async (id, goalId, status) => data(await http.patch(`/mentorship/requests/${id}/goals/${goalId}`, { status }));
  const addSession = async (id, payload) => data(await http.post(`/mentorship/requests/${id}/sessions`, payload));

  // ---------- warm introductions ----------
  async function getIntroPaths(targetId) {
    const d = data(await http.get("/intros/paths", { params: { target_id: targetId } })) || {};
    return {
      target: d.target || null,
      already_connected: Boolean(d.already_connected),
      can_request: Boolean(d.can_request),
      existing: d.existing || null,
      introducers: d.introducers || [],
    };
  }
  async function listIntros(box = "sent", page = 1, limit = 10) {
    const d = data(await http.get("/intros", { params: { box, page, limit } })) || {};
    return {
      intros: d.intros || [],
      canRequest: Boolean(d.can_request),
      canIntroduce: Boolean(d.can_introduce),
      pagination: pageOf(d.pagination, page, limit),
    };
  }
  const getIntro = async (id) => data(await http.get(`/intros/${id}`));
  const createIntro = async (payload) => data(await http.post("/intros", payload));

  // action: INTRODUCE | DECLINE
  async function respondToIntro(id, action, note) {
    const body = { action };
    if (String(note || "").trim()) body.note = String(note).trim();
    return data(await http.patch(`/intros/${id}/respond`, body));
  }
  const cancelIntro = async (id) => data(await http.patch(`/intros/${id}/cancel`));

  return {
    getMyMentorProfile, saveMentorProfile, listMentors, getMatches, getMentor,
    listMentorships, getMentorship, createMentorship, respondToMentorship, cancelMentorship, completeMentorship,
    addGoal, setGoalStatus, addSession,
    getIntroPaths, listIntros, getIntro, createIntro, respondToIntro, cancelIntro,
  };
}
