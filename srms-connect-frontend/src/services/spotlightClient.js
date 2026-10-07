// Talks to /api/spotlights. The HTTP client is injected so it can be tested without axios;
// spotlightService.js wires in the real authenticated instance.
// Members read live cards; the manage* calls are admin-only and the server enforces that.
export function createSpotlightClient(http) {
  const data = (response) => response.data?.data;

  async function listSpotlights() {
    const d = data(await http.get("/spotlights")) || {};
    return d.spotlights || [];
  }

  async function manageList({ status = "" } = {}, page = 1, limit = 20) {
    const params = { page, limit };
    if (status) params.status = status;
    const d = data(await http.get("/spotlights/manage", { params })) || {};
    return {
      spotlights: d.spotlights || [],
      counts: { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0, ...(d.counts || {}) },
      pagination: { page: d.pagination?.page || page, limit: d.pagination?.limit || limit, total: d.pagination?.total || 0, totalPages: d.pagination?.totalPages || 1 },
    };
  }

  const createSpotlight = async (payload) => data(await http.post("/spotlights", payload));
  const updateSpotlight = async (id, payload) => data(await http.patch(`/spotlights/${id}`, payload));
  const setSpotlightStatus = async (id, status) => data(await http.patch(`/spotlights/${id}/status`, { status }));
  const deleteSpotlight = async (id) => {
    await http.delete(`/spotlights/${id}`);
  };

  return { listSpotlights, manageList, createSpotlight, updateSpotlight, setSpotlightStatus, deleteSpotlight };
}
