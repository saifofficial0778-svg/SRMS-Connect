import { MIN_QUERY_LENGTH } from "../utils/searchParams.js";

// The navbar search behaviour as a small state machine, independent of React:
//   - waits for the user to stop typing (debounce)
//   - ignores too-short input
//   - drops responses that arrive after a newer query was typed (no stale results)
// States reported through onChange: idle | too-short | loading | success | error
export function createDebouncedSearcher({ search, onChange, delay = 350 }) {
  let timer = null;
  let latest = 0; // id of the newest request; older responses are ignored

  const emit = (state) => onChange(state);

  function cancel() {
    clearTimeout(timer);
    timer = null;
    latest += 1; // invalidate anything still in flight
  }

  function update(rawQuery) {
    cancel();
    const query = (rawQuery || "").trim();

    if (!query) {
      emit({ status: "idle", query, results: null });
      return;
    }
    if (query.length < MIN_QUERY_LENGTH) {
      emit({ status: "too-short", query, results: null });
      return;
    }

    emit({ status: "loading", query, results: null });
    const requestId = latest;

    timer = setTimeout(async () => {
      try {
        const results = await search(query);
        if (requestId === latest) emit({ status: "success", query, results });
      } catch {
        if (requestId === latest) emit({ status: "error", query, results: null });
      }
    }, delay);
  }

  return { update, cancel };
}
