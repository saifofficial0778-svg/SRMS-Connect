import { filtersToApiParams, PAGE_SIZE } from "../utils/searchParams.js";

// Talks to GET /api/search. The HTTP client is injected so this can be tested without axios
// or the browser; searchService.js wires in the real authenticated axios instance.
export function createSearchClient(http) {
  // Navbar quick search: a few people + posts matching one keyword.
  // Returns { people, posts, jobs } (jobs stay empty until that feature exists).
  async function searchAll(query, { signal } = {}) {
    const response = await http.get("/search", { params: { q: query, type: "all" }, signal });
    const data = response.data?.data || {};
    return {
      people: data.people || [],
      posts: data.posts || [],
      jobs: [],
    };
  }

  // Directory: filtered, paginated people.
  async function searchPeople(filters, page = 1, limit = PAGE_SIZE, { signal } = {}) {
    const response = await http.get("/search", { params: filtersToApiParams(filters, page, limit), signal });
    const data = response.data?.data || {};
    const pagination = data.pagination || {};
    return {
      people: data.people || [],
      pagination: {
        page: pagination.page || page,
        limit: pagination.limit || limit,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 1,
      },
    };
  }

  // Values for the directory's Branch / Batch dropdowns.
  async function getSearchFilters() {
    const response = await http.get("/search/filters");
    const data = response.data?.data || {};
    return {
      branches: data.branches || [],
      batchYears: data.batchYears || [],
    };
  }

  return { searchAll, searchPeople, getSearchFilters };
}
