import authApi from "./api";

/**
 * Global keyword search across people, posts, and jobs.
 *
 * THIS ENDPOINT DOES NOT EXIST ON THE BACKEND YET.
 * Once it does, this is the ONLY place that needs to change — the
 * Navbar/SearchBar/SearchResults components already call this function
 * and expect the shape below, so nothing else needs to be touched.
 *
 * Expected request:
 *   GET /search?q=<keyword>
 *
 * Expected response shape (adjust the fetch below to match whatever
 * your backend actually returns, then keep the return shape the same):
 *   {
 *     success: true,
 *     data: {
 *       people: [{ id, full_name, designation, location, profile_photo }],
 *       posts:  [{ id, content, full_name }],
 *       jobs:   [{ id, title, company }]
 *     }
 *   }
 */
export const searchAll = async (query) => {
  const response = await authApi.get("/search", { params: { q: query } });
  const data = response.data?.data || {};
  return {
    people: data.people || [],
    posts: data.posts || [],
    jobs: data.jobs || [],
  };
};