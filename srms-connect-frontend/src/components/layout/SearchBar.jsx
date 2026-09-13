import { useEffect, useRef, useState } from "react";
import { searchAll } from "../../services/searchService";
import SearchResults from "./SearchResults";
import { SearchIcon, CloseIcon } from "./navIcons";

const DEBOUNCE_MS = 350;

export default function SearchBar({ autoFocus = false, onClose, className = "" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced search — waits for the user to stop typing before calling
  // the backend, instead of firing a request on every keystroke.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchAll(query.trim());
        setResults(data);
      } catch {
        // Most likely cause right now: the /search endpoint doesn't exist
        // on the backend yet. Fail quietly instead of breaking the navbar.
        setError(true);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
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
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1B2438]/35">
          <SearchIcon className="w-4 h-4" />
        </span>
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search SRMS Connect..."
          className="w-full pl-10 pr-9 py-2 rounded-full bg-[#1B2438]/5 border border-transparent text-sm text-[#1B2438] placeholder:text-[#1B2438]/40 focus:outline-none focus:bg-white focus:border-[#C98A2B]/40 focus:ring-2 focus:ring-[#C98A2B]/20 transition-colors"
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1B2438]/40 hover:text-[#1B2438]/70"
            aria-label="Close search"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <SearchResults
          query={query.trim()}
          results={results}
          loading={loading}
          error={error}
          onSelect={() => {
            setOpen(false);
            onClose?.();
          }}
        />
      )}
    </div>
  );
}