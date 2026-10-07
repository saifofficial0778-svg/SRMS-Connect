import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getIndustryPulse } from "../../services/insightService";
import BarList from "../../components/insights/BarList";
import { DataSourceNote, InsightCard, InsightError, InsightSkeleton, InsightTabs, StatTile } from "../../components/insights/InsightParts";
import { formatShare, jobTypeName, pluralize, toBarRows, trendLabel } from "../../utils/insightFormat";

const TREND_TONES = { up: "text-success-700", down: "text-danger-700", flat: "text-ink/50" };

export default function IndustryPulsePage() {
  const [state, setState] = useState({ tick: -1, status: "loading", pulse: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getIndustryPulse()
      .then((pulse) => !cancelled && setState({ tick, status: "success", pulse }))
      .catch(() => !cancelled && setState({ tick, status: "error", pulse: null }));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const status = state.tick === tick ? state.status : "loading";
  const pulse = state.pulse;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-tight text-ink font-display sm:text-[28px]">
            Industry Pulse
          </h1>
          <p className="mt-1 text-sm text-ink/60">What SRMS alumni know and what jobs on SRMS Connect are asking for.</p>
        </div>
        <InsightTabs />
      </header>

      {status === "loading" && <InsightSkeleton />}
      {status === "error" && <InsightError onRetry={() => setTick((n) => n + 1)} />}

      {status === "success" && pulse && (
        <>
          <DataSourceNote text={pulse.data_source} generatedAt={pulse.generated_at} />

          {/* headline numbers */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile value={pulse.totals.alumni} label="Verified alumni" hint="Active alumni accounts" />
            <StatTile value={pulse.totals.alumni_with_skills} label="Alumni with skills listed" hint="The base for alumni skill shares" />
            <StatTile value={pulse.totals.open_jobs} label="Open jobs" hint="Currently listed" />
            <StatTile value={pulse.totals.open_jobs_with_skills} label="Open jobs listing skills" hint="The base for demand shares" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <InsightCard
              title="Most common skills among alumni"
              basis={`Number of alumni who list each skill. Share is of the ${pluralize(pulse.totals.alumni_with_skills, "alumnus", "alumni")} with skills on their profile.`}
            >
              <BarList
                rows={toBarRows(pulse.alumni_skills, { key: "skill_key", label: "skill", value: "count", detail: (s) => formatShare(s.share) })}
                unit="alumni"
                emptyText="No alumni have added skills to their profile yet."
              />
            </InsightCard>

            <InsightCard
              title="Most demanded skills"
              basis={`Number of open jobs asking for each skill. Share is of the ${pluralize(pulse.totals.open_jobs_with_skills, "open job")} that list skills.`}
            >
              <BarList
                rows={toBarRows(pulse.demanded_skills, { key: "skill_key", label: "skill", value: "count", detail: (s) => formatShare(s.share) })}
                unit="open jobs"
                emptyText="No open jobs list skills yet."
              />
            </InsightCard>

            <InsightCard title="Top companies hiring" basis="Open jobs per company, as posted on SRMS Connect.">
              <BarList
                rows={toBarRows(pulse.top_companies, { label: "company", value: "open_jobs", detail: (c) => formatShare(c.share) })}
                unit="open jobs"
                emptyText="No open jobs right now."
              />
            </InsightCard>

            <InsightCard title="Top job roles" basis="Open jobs per job title, exactly as posted.">
              <BarList
                rows={toBarRows(pulse.top_roles, { label: "title", value: "open_jobs", detail: (r) => formatShare(r.share) })}
                unit="open jobs"
                emptyText="No open jobs right now."
              />
              {pulse.job_types.length > 0 && (
                <p className="mt-4 border-t border-ink/8 pt-3 text-xs text-ink/60">
                  By type: {pulse.job_types.map((t) => `${jobTypeName(t.job_type)} ${t.open_jobs}`).join(" · ")}
                </p>
              )}
            </InsightCard>
          </div>

          <InsightCard title="Trending skills" basis={pulse.trending_skills.basis}>
            {pulse.trending_skills.skills.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/45">
                No jobs with skills were posted in the last {pulse.trending_skills.window_days} days, so there is no trend to show.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-xs text-ink/50">
                      <th scope="col" className="py-2 pr-3 font-medium">Skill</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Jobs, last {pulse.trending_skills.window_days} days</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Jobs, {pulse.trending_skills.window_days} days before</th>
                      <th scope="col" className="py-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pulse.trending_skills.skills.map((skill) => {
                      const trend = trendLabel(skill);
                      return (
                        <tr key={skill.skill_key} className="border-b border-ink/5 last:border-0">
                          <th scope="row" className="py-2 pr-3 font-medium text-ink">{skill.skill}</th>
                          <td className="py-2 pr-3 text-right tabular-nums text-ink">{skill.recent}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-ink/60">{skill.previous}</td>
                          {/* symbol + words, so the direction never depends on colour */}
                          <td className={`py-2 ${TREND_TONES[trend.tone]}`}>
                            <span aria-hidden="true" className="mr-1.5">{trend.symbol}</span>
                            {trend.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </InsightCard>

          <p className="text-center text-sm text-ink/60">
            Want to see how your own skills compare?{" "}
            <Link to="/skill-gap" className="font-medium text-accent-700 hover:text-accent-800">Open My Skill Gap</Link>
          </p>
        </>
      )}
    </div>
  );
}
