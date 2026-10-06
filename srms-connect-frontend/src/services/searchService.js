import authApi from "./api";
import { createSearchClient } from "./searchClient";

// Real backend search (GET /api/search). Response normalising lives in searchClient.js.
export const { searchAll, searchPeople, getSearchFilters } = createSearchClient(authApi);
