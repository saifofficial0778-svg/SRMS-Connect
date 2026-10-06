import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMatches, listMentors } from "../../services/mentorshipService";
import { EmptyCard, LoadingCard, MentorCard, PageHeader, Pager } from "../../components/mentorship/MentorshipParts";
import { inputClass } from "../../components/mentorship/mentorshipStyles";
import { SearchIcon } from "../../components/layout/navIcons";
import { TOPICS, hasMentorFilters, mentorFiltersToUrl, urlToMentorFilters } from "../../utils/mentorshipFormat";

const TYPING_DEBOUNCE_MS = 400;

// Mentors directory, with "Recommended for you" on top: the same filters (topic, skills) feed both
// the list and the matching rules.
export default function MentorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = useMemo(() => urlToMentorFilters(searchParams), [searchParams]);
  const urlKey = searchParams.toString();

  // text boxes are typed into freely and reach the URL (and the API) after a short pause
  const [draft, setDraft] = useState(filters);
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setDraft((d) => (mentorFiltersToUrl(d, page).toString() === urlKey ? d : filters));
  }
  const typingTimer = useRef(null);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const [list, setList] = useState({ key: null, status: "loading", mentors: [], pagination: null });
  const [recommended, setRecommended] = useState({ key: null, matches: [], criteria: null });
  const [tick, setTick] = useState(0);

  const listKey = `${urlKey}#${tick}`;
  useEffect(() => {
    let cancelled = false;
    listMentors(filters, page)
      .then((data) => !cancelled && setList({ key: listKey, status: "success", ...data }))
      .catch(() => !cancelled && setList({ key: listKey, status: "error", mentors: [], pagination: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  // recommendations depend only on what you want help with (topic + skills), not on the page
  const matchKey = `${filters.topic}|${filters.skills}`;
  useEffect(() => {
    let cancelled = false;
    getMatches(filters)
      .then((data) => !cancelled && setRecommended({ key: matchKey, ...data }))
      .catch(() => !cancelled && setRecommended({ key: matchKey, matches: [], criteria: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  const commit = (next, nextPage = 1) => setSearchParams(mentorFiltersToUrl(next, nextPage));
  const change = (patch, typing) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    clearTimeout(typingTimer.current);
    if (typing) typingTimer.current = setTimeout(() => commit(next), TYPING_DEBOUNCE_MS);
    else commit(next);
  };
  const clear = () => {
    clearTimeout(typingTimer.current);
    setDraft({ q: "", topic: "", skills: "" });
    commit({ q: "", topic: "", skills: "" });
  };

  const status = list.key === listKey ? list.status : "loading";
  const matches = recommended.key === matchKey ? recommended.matches : [];
  const criteria = recommended.key === matchKey ? recommended.criteria : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <PageHeader title="Mentorship" subtitle="Find an SRMS alumnus who can guide you, and see why they are a good match." />

      <section aria-label="Filters" className="grid gap-3 rounded-2xl border border-[#1B2438]/10 bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#1B2438]/60">Search</span>
          <span className="relative block">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1B2438]/35"><SearchIcon className="w-4 h-4" /></span>
            <input
              type="search"
              value={draft.q}
              onChange={(e) => change({ q: e.target.value }, true)}
              placeholder="Name, company or bio"
              aria-label="Search mentors"
              className={`${inputClass} pl-10`}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#1B2438]/60">I want help with</span>
          <select value={draft.topic} onChange={(e) => change({ topic: e.target.value }, false)} className={inputClass}>
            <option value="">Any topic</option>
            {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#1B2438]/60">Skills (comma separated)</span>
          <input value={draft.skills} onChange={(e) => change({ skills: e.target.value }, true)} placeholder="e.g. React, SQL" className={inputClass} />
        </label>
        <button
          onClick={clear}
          disabled={!hasMentorFilters(draft)}
          className="rounded-lg border border-[#1B2438]/15 px-4 py-2.5 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-40"
        >
          Clear
        </button>
      </section>

      {matches.length > 0 && (
        <section aria-labelledby="recommended-heading" className="space-y-3">
          <div>
            <h2 id="recommended-heading" className="text-lg text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Recommended for you
            </h2>
            {criteria && (
              <p className="text-xs text-[#1B2438]/55">
                {criteria.rule}
                {criteria.skill_gap_considered?.length > 0 && <> Skills from your skill gap that count: {criteria.skill_gap_considered.join(", ")}.</>}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {matches.slice(0, 4).map((mentor) => <MentorCard key={mentor.user_id} mentor={mentor} />)}
          </div>
        </section>
      )}

      <section aria-labelledby="all-mentors-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="all-mentors-heading" className="text-lg text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>All mentors</h2>
          <p aria-live="polite" className="text-sm text-[#1B2438]/55">
            {status === "success" && list.pagination ? `${list.pagination.total} ${list.pagination.total === 1 ? "mentor" : "mentors"}` : ""}
          </p>
        </div>

        {status === "loading" && <LoadingCard />}
        {status === "error" && (
          <EmptyCard title="Couldn't load mentors.">
            <button onClick={() => setTick((n) => n + 1)} className="mt-3 rounded-lg bg-[#1B2438] px-4 py-2 text-sm text-white hover:bg-[#141B2C]">Try again</button>
          </EmptyCard>
        )}
        {status === "success" && list.mentors.length === 0 && (
          <EmptyCard title={hasMentorFilters(filters) ? "No mentors match these filters" : "No mentors yet"}>
            {hasMentorFilters(filters) ? "Try a different topic or fewer skills." : "Alumni can become mentors from the Mentor profile tab."}
          </EmptyCard>
        )}
        {status === "success" && list.mentors.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {list.mentors.map((mentor) => <MentorCard key={mentor.user_id} mentor={mentor} />)}
            </div>
            <Pager page={page} totalPages={list.pagination.totalPages} onChange={(p) => commit(filters, p)} />
          </>
        )}
      </section>
    </div>
  );
}
