import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSkillGap } from "../../services/insightService";
import { DataSourceNote, InsightCard, InsightError, InsightSkeleton, InsightTabs, StatTile } from "../../components/insights/InsightParts";
import { JOB_TYPES, jobTypeLabel } from "../../utils/jobFormat";
import {
  alumniSentence,
  barWidth,
  coverageSentence,
  demandSentence,
  formatShare,
  gapFiltersToUrl,
  gapState,
  hasGapFilters,
  urlToGapFilters,
} from "../../utils/insightFormat";

const inputClass =
  "w-full rounded-lg border border-[#1B2438]/15 bg-white px-3 py-2 text-sm text-[#1B2438] placeholder:text-[#1B2438]/35 focus:outline-none focus:border-[#C98A2B]/60 focus:ring-2 focus:ring-[#C98A2B]/20";

const TYPING_DEBOUNCE_MS = 400;

export default function SkillGapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => urlToGapFilters(searchParams), [searchParams]);
  const urlKey = searchParams.toString();

  // the role box is typed into freely and reaches the URL (and the API) after a short pause
  const [roleDraft, setRoleDraft] = useState(filters.role);
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setRoleDraft((d) => (d.trim() === filters.role ? d : filters.role));
  }
  const typingTimer = useRef(null);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const [state, setState] = useState({ key: null, status: "loading", report: null });
  const [tick, setTick] = useState(0);
  const requestKey = `${urlKey}#${tick}`;

  useEffect(() => {
    let cancelled = false;
    getSkillGap(filters)
      .then((report) => !cancelled && setState({ key: requestKey, status: "success", report }))
      .catch(() => !cancelled && setState({ key: requestKey, status: "error", report: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const commit = (next) => setSearchParams(gapFiltersToUrl(next));
  const onRoleChange = (value) => {
    setRoleDraft(value);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => commit({ ...filters, role: value }), TYPING_DEBOUNCE_MS);
  };
  const clearFilters = () => {
    clearTimeout(typingTimer.current);
    setRoleDraft("");
    commit({ job_type: "", role: "" });
  };

  const status = state.key === requestKey ? state.status : "loading";
  const report = state.report;
  const view = report ? gapState(report) : null;
  const summary = report?.summary;
  const maxDemand = report?.missing?.[0]?.jobs_requiring || 0; // the list arrives ranked

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            My Skill Gap
          </h1>
          <p className="mt-1 text-sm text-[#1B2438]/60">Your profile skills compared with what open jobs on SRMS Connect ask for.</p>
        </div>
        <InsightTabs />
      </header>

      {/* which jobs to compare against */}
      <section aria-label="Filters" className="grid gap-3 rounded-2xl border border-[#1B2438]/10 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#1B2438]/60">Role (matches job titles)</span>
          <input value={roleDraft} onChange={(e) => onRoleChange(e.target.value)} placeholder="e.g. backend, data analyst" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[#1B2438]/60">Job type</span>
          <select value={filters.job_type} onChange={(e) => commit({ ...filters, role: roleDraft, job_type: e.target.value })} className={inputClass}>
            <option value="">Any type</option>
            {JOB_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <button
          onClick={clearFilters}
          disabled={!hasGapFilters({ ...filters, role: roleDraft })}
          className="rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-40"
        >
          Clear
        </button>
      </section>

      {status === "loading" && <InsightSkeleton />}
      {status === "error" && <InsightError onRetry={() => setTick((n) => n + 1)} />}

      {status === "success" && report && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile value={summary.jobs_with_skills} label="Jobs compared" hint={`${summary.jobs_considered} open ${summary.jobs_considered === 1 ? "job matches" : "jobs match"} your filters`} />
            <StatTile value={summary.matched_skills} label="Demanded skills you have" hint={`of ${summary.demanded_skills} skills these jobs ask for`} />
            <StatTile value={summary.missing_skills} label="Skills you're missing" hint="Ranked below" />
            <StatTile value={formatShare(summary.coverage_percent)} label="Requirements met" hint={`${summary.requirements_met} of ${summary.requirements_total}`} />
          </div>

          {view === "no-jobs" && (
            <InsightCard title="Nothing to compare yet">
              <p className="text-sm text-[#1B2438]/65">
                {hasGapFilters(filters)
                  ? "No open jobs match these filters. Try a broader role or a different job type."
                  : "There are no open jobs on SRMS Connect right now, so there is no demand to compare your skills with."}
              </p>
            </InsightCard>
          )}

          {view === "no-job-skills" && (
            <InsightCard title="These jobs don't list skills">
              <p className="text-sm text-[#1B2438]/65">
                {summary.jobs_considered} open {summary.jobs_considered === 1 ? "job matches" : "jobs match"}, but none of them lists required skills, so a gap can't be calculated.
              </p>
            </InsightCard>
          )}

          {view === "no-profile-skills" && (
            <div className="rounded-2xl border border-[#C98A2B]/40 bg-[#C98A2B]/[0.06] px-5 py-4 text-sm text-[#1B2438]/80">
              You haven't added any skills to your profile, so every demanded skill shows as missing.{" "}
              <Link to="/profile" className="font-medium text-[#9F6C1E] underline">Add your skills</Link> to get a real comparison.
            </div>
          )}

          {view === "all-matched" && (
            <InsightCard title="No gaps for these jobs">
              <p className="text-sm text-[#1B2438]/65">
                <span aria-hidden="true">{"✓ "}</span>
                You already list every skill these jobs ask for. {coverageSentence(summary)}
              </p>
            </InsightCard>
          )}

          {report.missing.length > 0 && (
            <InsightCard title="Skills to learn next" basis={report.ranking_rule}>
              <ol className="divide-y divide-[#1B2438]/8">
                {report.missing.map((entry, index) => (
                  <li key={entry.skill_key} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="text-base font-medium text-[#1B2438]">
                        <span className="mr-2 tabular-nums text-sm text-[#1B2438]/40">{index + 1}.</span>
                        {entry.skill}
                      </h3>
                      <p className="text-sm tabular-nums text-[#1B2438]/80">{demandSentence(entry, summary)}</p>
                    </div>
                    {/* bar = jobs asking for it, relative to the most demanded missing skill */}
                    <div className="mt-1.5 h-2.5 w-full" aria-hidden="true">
                      <div className="h-full rounded-r bg-[#C98A2B]" style={{ width: `${barWidth(entry.jobs_requiring, maxDemand)}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-[#1B2438]/55">
                      {alumniSentence(entry.alumni_with_skill)}
                      {entry.example_jobs.length > 0 && (
                        <>
                          {" · "}Asked for in{" "}
                          {entry.example_jobs.map((job, i) => (
                            <span key={job.id}>
                              {i > 0 && ", "}
                              <Link to={`/jobs/${job.id}`} className="font-medium text-[#9F6C1E] hover:underline">
                                {job.title}
                              </Link>
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </InsightCard>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <InsightCard title="Skills you already have that jobs want" basis={coverageSentence(summary) || "Skills on your profile that these jobs ask for."}>
              {report.matched.length === 0 ? (
                <p className="py-4 text-sm text-[#1B2438]/45">None of your profile skills are asked for by these jobs yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {report.matched.map((entry) => (
                    <li key={entry.skill_key} className="rounded-full border border-[#3F6B52]/30 bg-[#3F6B52]/[0.08] px-3 py-1 text-sm text-[#2F5340]">
                      <span aria-hidden="true">{"✓ "}</span>
                      {entry.skill}
                      <span className="ml-1.5 text-xs text-[#1B2438]/55">{entry.jobs_requiring} {entry.jobs_requiring === 1 ? "job" : "jobs"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {report.your_skills.length > 0 && (
                <p className="mt-4 border-t border-[#1B2438]/8 pt-3 text-xs text-[#1B2438]/55">
                  On your profile: {report.your_skills.join(", ")}.{" "}
                  <Link to="/profile" className="font-medium text-[#9F6C1E] hover:underline">Edit skills</Link>
                </p>
              )}
            </InsightCard>

            <InsightCard title="Closest job matches" basis="Share of each job's listed skills that are on your profile.">
              {report.job_matches.length === 0 ? (
                <p className="py-4 text-sm text-[#1B2438]/45">No jobs to compare.</p>
              ) : (
                <ul className="space-y-3">
                  {report.job_matches.map((job) => (
                    <li key={job.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <Link to={`/jobs/${job.id}`} className="min-w-0 truncate text-sm font-medium text-[#1B2438] hover:text-[#9F6C1E]">
                          {job.title} <span className="font-normal text-[#1B2438]/55">· {job.company} · {jobTypeLabel(job.job_type)}</span>
                        </Link>
                        <span className="shrink-0 text-sm tabular-nums text-[#1B2438]/80">
                          {job.matched}/{job.required} <span className="text-xs text-[#1B2438]/50">({formatShare(job.match_percent)})</span>
                        </span>
                      </div>
                      {job.missing.length > 0 && <p className="mt-0.5 text-xs text-[#1B2438]/55">Missing: {job.missing.join(", ")}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </InsightCard>
          </div>

          <DataSourceNote text={report.data_source} generatedAt={report.generated_at} />
        </>
      )}
    </div>
  );
}
