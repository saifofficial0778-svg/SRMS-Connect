import { useEffect, useRef, useState } from "react";
import { searchAll } from "../../services/searchService";
import { createDebouncedSearcher } from "../../services/searchFlow";
import SearchResults from "./SearchResults";
import { SearchIcon, CloseIcon } from "./navIcons";

const DEBOUNCE_MS = 350;

export default function SearchBar({ autoFocus = false, onClose, className = "" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle", results: null });
  const wrapperRef = useRef(null);
  const searcherRef = useRef(null);

  // Debounce, minimum length and stale-response handling live in searchFlow.js
  // (unit tested); this component only renders whatever state it reports.
  useEffect(() => {
    const searcher = createDebouncedSearcher({
      search: searchAll,
      onChange: setState,
      delay: DEBOUNCE_MS,
    });
    searcherRef.current = searcher;
    return () => searcher.cancel();
  }, []);

  useEffect(() => {
    searcherRef.current?.update(query);
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35">
          <SearchIcon className="w-4 h-4" />
        </span>
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search people and posts"
          aria-label="Search SRMS Connect"
          className="h-9 w-full rounded-lg border border-transparent bg-ink/[0.06] pl-10 pr-9 text-sm text-ink placeholder:text-ink/45 transition-colors hover:bg-ink/[0.08] focus:border-brand/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/70"
            aria-label="Close search"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <SearchResults
          query={query.trim()}
          status={state.status}
          results={state.results}
          onSelect={() => {
            setOpen(false);
            onClose?.();
          }}
        />
      )}
    </div>
  );
}
