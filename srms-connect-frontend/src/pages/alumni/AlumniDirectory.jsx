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
import { SearchX } from "lucide-react";
import Button from "../../components/ui/Button";
import { EmptyState, ErrorState, PageHeader, Pager, SkeletonCard, Tabs } from "../../components/ui/Primitives";
import { NETWORK_TABS } from "../../utils/navigation";
import PersonCard from "../../components/search/PersonCard";

const TYPING_DEBOUNCE_MS = 400;
const TEXT_FIELDS = ["q", "company", "designation", "skills"];

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
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader eyebrow="Network" title={title} subtitle="Find verified alumni and students across batches, companies and skills.">
        <Tabs tabs={NETWORK_TABS} label="Network" />
      </PageHeader>

      <DirectoryFilters draft={draft} onChange={handleChange} onClear={handleClear} options={options} />

      <div aria-live="polite" className="text-sm text-ink/55 min-h-5">
        {status === "success" && pagination && (
          <>
            {pagination.total} {pagination.total === 1 ? "person" : "people"} found
          </>
        )}
      </div>

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} avatar lines={2} />)}
        </div>
      )}

      {status === "error" && <ErrorState title="Couldn't load the directory" onRetry={() => setRetryTick((n) => n + 1)} />}

      {status === "success" && people.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="No matching people found"
          action={hasAnyCriteria(filters) ? <Button variant="secondary" size="sm" onClick={handleClear}>Clear filters</Button> : null}
        >
          {hasAnyCriteria(filters) ? "Try removing a filter or searching a different name." : "Nobody is listed yet."}
        </EmptyState>
      )}

      {status === "success" && people.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {people.map((person) => (
              <PersonCard key={person.user_id} person={person} />
            ))}
          </div>

          <Pager page={page} totalPages={totalPages} onChange={goToPage} />
        </>
      )}
    </div>
  );
}
