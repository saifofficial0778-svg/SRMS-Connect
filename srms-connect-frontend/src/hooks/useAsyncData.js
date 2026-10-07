import { useEffect, useState } from "react";

// Loads something once when the component appears.
//   status: "loading" -> "ready" (data set) or "empty" (the request failed; callers simply hide)
// Used by the home page's side cards, which must never hold up or break the feed.
export default function useAsyncData(load) {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch(() => !cancelled && setState({ status: "empty", data: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
