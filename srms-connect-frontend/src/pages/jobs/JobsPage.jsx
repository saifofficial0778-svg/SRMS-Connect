import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listJobs } from "../../services/jobService";
import {
  JOBS_PAGE_SIZE,
  clearJobFilters,
  hasAnyJobCriteria,
  jobFiltersToUrl,
  urlToJobFilters,
} from "../../utils/jobParams";
import JobFilters from "../../components/jobs/JobFilters";
import JobCard from "../../components/jobs/JobCard";

const TYPING_DEBOUNCE_MS = 400;
const TEXT_FIELDS = ["q", "company", "location", "skills", "experience"];

function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse space-y-3">
      <div className="h-5 w-1/2 rounded bg-ink/10" />
      <div className="h-3 w-1/3 rounded bg-ink/8" />
      <div className="h-3 w-3/4 rounded bg-ink/8" />
    </div>
  );
}

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = useMemo(() => urlToJobFilters(searchParams), [searchParams]);

  // what's typed right now; text fields reach the URL (and the API) after a short pause
  const [draft, setDraft] = useState(filters);
  const typingTimer = useRef(null);

  const [result, setResult] = useState({ key: null, status: "loading", jobs: [], pagination: null, canPost: false });
  const [retryTick, setRetryTick] = useState(0);

  // keep the form in sync when the URL changes from outside (back button); a draft that already
  // produces this URL is kept so a trailing space mid-typing isn't eaten
  const urlKey = searchParams.toString();
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setDraft((d) => (jobFiltersToUrl(d, page).toString() === urlKey ? d : filters));
  }

  // "loading" is derived: a stored result only counts if it belongs to the request on screen
  const requestKey = `${urlKey}#${retryTick}`;
  useEffect(() => {
    let cancelled = false;

    listJobs(filters, page, JOBS_PAGE_SIZE)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: "success", ...data });
      })
      .catch(() => {
        if (!cancelled) setResult((r) => ({ ...r, key: requestKey, status: "error", jobs: [], pagination: null }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const commit = useCallback(
    (nextFilters, nextPage = 1) => setSearchParams(jobFiltersToUrl(nextFilters, nextPage)),
    [setSearchParams]
  );

  const handleChange = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    clearTimeout(typingTimer.current);

    if (TEXT_FIELDS.some((k) => k in patch)) {
      typingTimer.current = setTimeout(() => commit(next), TYPING_DEBOUNCE_MS);
    } else {
      commit(next);
    }
  };

  const handleClear = () => {
    clearTimeout(typingTimer.current);
    const cleared = clearJobFilters(draft);
    setDraft(cleared);
    commit(cleared);
  };

  const switchTab = (tab) => {
    clearTimeout(typingTimer.current);
    const next = { ...clearJobFilters(draft), tab };
    setDraft(next);
    commit(next);
  };

  const goToPage = (nextPage) => {
    commit(filters, nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const status = result.key === requestKey ? result.status : "loading";
  const { jobs, pagination, canPost } = result;
  const totalPages = pagination?.totalPages || 1;
  const mine = filters.tab === "mine";

  const tabClass = (active) =>
    `rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-tight text-ink font-display sm:text-[28px]">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-ink/60">Opportunities posted by verified SRMS alumni.</p>
        </div>

        {canPost && (
          <Link
            to="/jobs/new"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Post a job
          </Link>
        )}
      </header>

      {/* only alumni can have jobs of their own */}
      {(canPost || mine) && (
        <div role="tablist" aria-label="Jobs" className="inline-flex rounded-lg bg-ink/[0.06] p-1">
          <button role="tab" aria-selected={!mine} onClick={() => switchTab("all")} className={tabClass(!mine)}>
            All jobs
          </button>
          <button role="tab" aria-selected={mine} onClick={() => switchTab("mine")} className={tabClass(mine)}>
            My jobs
          </button>
        </div>
      )}

      <JobFilters draft={draft} onChange={handleChange} onClear={handleClear} />

      <div aria-live="polite" className="min-h-5 text-sm text-ink/55">
        {status === "success" && pagination && (
          <>
            {pagination.total} {pagination.total === 1 ? "job" : "jobs"} found
          </>
        )}
      </div>

      {status === "loading" && (
        <div className="space-y-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {status === "error" && (
        <div className="card py-14 text-center">
          <p className="font-medium text-ink">Couldn't load jobs.</p>
          <button
            onClick={() => setRetryTick((n) => n + 1)}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600"
          >
            Try again
          </button>
        </div>
      )}

      {status === "success" && jobs.length === 0 && (
        <div className="card py-14 px-6 text-center">
          <p className="font-medium text-ink">
            {mine && !hasAnyJobCriteria(filters) ? "You haven't posted any jobs yet" : "No matching jobs found"}
          </p>
          <p className="mt-1 text-sm text-ink/55">
            {hasAnyJobCriteria(filters)
              ? "Try removing a filter or searching for something else."
              : mine
                ? "Post a job to help students and fellow alumni."
                : "Check back soon, new jobs are added by alumni."}
          </p>
          {hasAnyJobCriteria(filters) && (
            <button
              onClick={handleClear}
              className="mt-4 rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {status === "success" && jobs.length > 0 && (
        <>
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-ink/60">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink/80 hover:bg-ink/5 disabled:opacity-40"
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
