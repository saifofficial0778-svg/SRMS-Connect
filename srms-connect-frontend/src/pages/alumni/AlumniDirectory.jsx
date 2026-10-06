import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchPeople, getSearchFilters } from "../../services/searchService";
import {
  PAGE_SIZE,
  clearRefinements,
  filtersToUrl,
  hasAnyCriteria,
  urlToFilters,
} from "../../utils/searchParams";
import DirectoryFilters from "../../components/search/DirectoryFilters";
import PersonCard from "../../components/search/PersonCard";

const TYPING_DEBOUNCE_MS = 400;
const TEXT_FIELDS = ["q", "company", "designation", "skills"];

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="h-14 w-14 rounded-full bg-[#1B2438]/10" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-1/2 rounded bg-[#1B2438]/10" />
          <div className="h-3 w-2/3 rounded bg-[#1B2438]/8" />
          <div className="h-3 w-1/3 rounded bg-[#1B2438]/8" />
        </div>
      </div>
    </div>
  );
}

export default function AlumniDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = useMemo(() => urlToFilters(searchParams), [searchParams]);

  // what's typed right now; text fields reach the URL (and the API) after a short pause
  const [draft, setDraft] = useState(filters);
  const typingTimer = useRef(null);

  const [options, setOptions] = useState({ branches: [], batchYears: [] });
  const [result, setResult] = useState({ key: null, status: "loading", people: [], pagination: null });
  const [retryTick, setRetryTick] = useState(0);

  // Keep the form in sync when the URL changes from outside (back button, navbar "See all").
  // Adjusting state during render is React's recommended alternative to an effect here; a draft
  // that already produces this URL is kept as-is so a trailing space mid-typing isn't eaten.
  const urlKey = searchParams.toString();
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setDraft((d) => (filtersToUrl(d, page).toString() === urlKey ? d : filters));
  }

  // dropdown values, fetched once
  useEffect(() => {
    let cancelled = false;
    getSearchFilters()
      .then((data) => !cancelled && setOptions(data))
      .catch(() => {
        // dropdowns just stay empty; text filters still work
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch whenever the URL-backed filters/page change (or "Try again" is pressed). "Loading" is
  // derived: a stored result only counts if it belongs to the request currently on screen.
  const requestKey = `${urlKey}#${retryTick}`;
  useEffect(() => {
    let cancelled = false;

    searchPeople(filters, page, PAGE_SIZE)
      .then(({ people, pagination }) => {
        if (!cancelled) setResult({ key: requestKey, status: "success", people, pagination });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, status: "error", people: [], pagination: null });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const commit = useCallback(
    (nextFilters, nextPage = 1) => setSearchParams(filtersToUrl(nextFilters, nextPage)),
    [setSearchParams]
  );

  const handleChange = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    clearTimeout(typingTimer.current);

    const isTyping = TEXT_FIELDS.some((k) => k in patch);
    if (isTyping) {
      typingTimer.current = setTimeout(() => commit(next), TYPING_DEBOUNCE_MS);
    } else {
      commit(next); // selects and tabs apply immediately
    }
  };

  const handleClear = () => {
    clearTimeout(typingTimer.current);
    const cleared = clearRefinements(draft);
    setDraft(cleared);
    commit(cleared);
  };

  const goToPage = (nextPage) => {
    commit(filters, nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const status = result.key === requestKey ? result.status : "loading";
  const { people, pagination } = result;
  const totalPages = pagination?.totalPages || 1;
  const title = filters.role === "STUDENT" ? "Student Directory" : filters.role === "ALL" ? "People Directory" : "Alumni Directory";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <header>
        <h1 className="text-3xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
          {title}
        </h1>
        <p className="mt-1 text-sm text-[#1B2438]/60">
          Find verified alumni and students across batches, companies and skills.
        </p>
      </header>

      <DirectoryFilters draft={draft} onChange={handleChange} onClear={handleClear} options={options} />

      <div aria-live="polite" className="text-sm text-[#1B2438]/55 min-h-5">
        {status === "success" && pagination && (
          <>
            {pagination.total} {pagination.total === 1 ? "person" : "people"} found
          </>
        )}
      </div>

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white py-14 text-center">
          <p className="font-medium text-[#1B2438]">Couldn't load the directory.</p>
          <button
            onClick={() => setRetryTick((n) => n + 1)}
            className="mt-4 rounded-lg bg-[#1B2438] px-4 py-2 text-sm text-white hover:bg-[#141B2C]"
          >
            Try again
          </button>
        </div>
      )}

      {status === "success" && people.length === 0 && (
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white py-14 text-center px-6">
          <p className="font-medium text-[#1B2438]">No matching people found</p>
          <p className="mt-1 text-sm text-[#1B2438]/55">
            {hasAnyCriteria(filters) ? "Try removing a filter or searching a different name." : "Nobody is listed yet."}
          </p>
          {hasAnyCriteria(filters) && (
            <button
              onClick={handleClear}
              className="mt-4 rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {status === "success" && people.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {people.map((person) => (
              <PersonCard key={person.user_id} person={person} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-[#1B2438]/15 bg-white px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-[#1B2438]/60">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-[#1B2438]/15 bg-white px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
