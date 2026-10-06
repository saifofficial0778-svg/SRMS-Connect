import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listRequests } from "../../services/careerService";
import {
  CAREER_PAGE_SIZE,
  REQUEST_TYPES,
  STATUS_OPTIONS,
  careerFiltersToUrl,
  defaultBox,
  urlToCareerFilters,
} from "../../utils/careerFormat";
import RequestCard from "../../components/career/RequestCard";

const selectClass =
  "rounded-lg border border-[#1B2438]/15 bg-white px-3 py-2 text-sm text-[#1B2438] focus:outline-none focus:border-[#C98A2B]/60 focus:ring-2 focus:ring-[#C98A2B]/20";

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 animate-pulse">
      <div className="flex gap-3">
        <div className="h-11 w-11 rounded-full bg-[#1B2438]/10" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-1/2 rounded bg-[#1B2438]/10" />
          <div className="h-3 w-3/4 rounded bg-[#1B2438]/8" />
        </div>
      </div>
    </div>
  );
}

// Students see what they asked for ("Sent"); alumni see what they were asked ("Received").
export default function CareerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters: urlFilters, page } = useMemo(() => urlToCareerFilters(searchParams), [searchParams]);

  const [result, setResult] = useState({ key: null, status: "loading", requests: [], pagination: null, canRequest: false, canRespond: false });
  const [retryTick, setRetryTick] = useState(0);

  // With no box in the URL, the first response tells us the role and so which box is the natural
  // one. Until then "sent" is requested; an alumnus is then switched to "received".
  const caps = { canRequest: result.canRequest, canRespond: result.canRespond };
  const box = urlFilters.box || (result.key ? defaultBox(caps) : "sent");
  const filters = useMemo(() => ({ ...urlFilters, box }), [urlFilters, box]);

  const requestKey = `${careerFiltersToUrl(filters, page).toString()}#${retryTick}`;
  useEffect(() => {
    let cancelled = false;
    listRequests(filters, page, CAREER_PAGE_SIZE)
      .then((data) => !cancelled && setResult({ key: requestKey, status: "success", ...data }))
      .catch(() => !cancelled && setResult((r) => ({ ...r, key: requestKey, status: "error", requests: [], pagination: null })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const update = (patch) => setSearchParams(careerFiltersToUrl({ ...filters, ...patch }, 1));
  const goToPage = (nextPage) => {
    setSearchParams(careerFiltersToUrl(filters, nextPage));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const status = result.key === requestKey ? result.status : "loading";
  const { requests, pagination, canRequest, canRespond } = result;
  const totalPages = pagination?.totalPages || 1;
  const hasFilters = Boolean(filters.type || filters.status);

  const tabClass = (active) =>
    `rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-white text-[#1B2438] shadow-sm" : "text-[#1B2438]/55 hover:text-[#1B2438]"
    }`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Career help
          </h1>
          <p className="mt-1 text-sm text-[#1B2438]/60">Referrals, resume reviews and questions between students and alumni.</p>
        </div>

        {canRequest && (
          <Link
            to="/career/new"
            className="rounded-lg bg-[#C98A2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B37A22] transition-colors"
          >
            Ask for help
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {/* both tabs only when the person can be on both sides */}
        {canRequest && canRespond ? (
          <div role="tablist" aria-label="Requests" className="inline-flex rounded-lg bg-[#1B2438]/5 p-1">
            <button role="tab" aria-selected={box === "sent"} onClick={() => update({ box: "sent" })} className={tabClass(box === "sent")}>
              Sent
            </button>
            <button role="tab" aria-selected={box === "received"} onClick={() => update({ box: "received" })} className={tabClass(box === "received")}>
              Received
            </button>
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-[#1B2438]">{box === "received" ? "Requests you received" : "Your requests"}</h2>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <select aria-label="Type" value={filters.type} onChange={(e) => update({ type: e.target.value })} className={selectClass}>
            <option value="">All types</option>
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.plural}</option>
            ))}
          </select>
          <select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })} className={selectClass}>
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div aria-live="polite" className="min-h-5 text-sm text-[#1B2438]/55">
        {status === "success" && pagination && (
          <>
            {pagination.total} {pagination.total === 1 ? "request" : "requests"}
          </>
        )}
      </div>

      {status === "loading" && (
        <div className="space-y-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white py-14 text-center">
          <p className="font-medium text-[#1B2438]">Couldn't load your requests.</p>
          <button
            onClick={() => setRetryTick((n) => n + 1)}
            className="mt-4 rounded-lg bg-[#1B2438] px-4 py-2 text-sm text-white hover:bg-[#141B2C]"
          >
            Try again
          </button>
        </div>
      )}

      {status === "success" && requests.length === 0 && (
        <div className="rounded-2xl border border-[#1B2438]/10 bg-white py-14 px-6 text-center">
          <p className="font-medium text-[#1B2438]">
            {hasFilters ? "No requests match these filters" : box === "received" ? "No one has asked you for help yet" : "You haven't asked for help yet"}
          </p>
          <p className="mt-1 text-sm text-[#1B2438]/55">
            {hasFilters
              ? "Try a different type or status."
              : box === "received"
                ? "Requests from students you are connected with will show up here."
                : "Ask a connected alumnus for a referral, a resume review, or career advice."}
          </p>
          {hasFilters && (
            <button
              onClick={() => update({ type: "", status: "" })}
              className="mt-4 rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {status === "success" && requests.length > 0 && (
        <>
          <div className="space-y-4">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
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
              <span className="text-sm text-[#1B2438]/60">Page {page} of {totalPages}</span>
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
