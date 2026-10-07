import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BarChart3, Bookmark, Briefcase, CalendarDays, Compass, Eye, MapPin, Megaphone, TrendingUp, UserPlus, Users, Video } from "lucide-react";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import Button from "../ui/Button";
import { Skeleton } from "../ui/Primitives";
import { academicLine, headline, isVerifiedAlumni } from "../../utils/personFormat";
import { categoryLabel, dateBadge, profileCompletion, suggestionReason, whenLabel, whereLabel } from "../../utils/spotlightFormat";
import { experienceLabel, isSafeHttpsUrl, jobTypeLabel } from "../../utils/jobFormat";
import { formatCount } from "../../utils/analyticsFormat";
import { getSuggestions, sendConnectionRequest } from "../../services/connectionService";
import { listJobs } from "../../services/jobService";
import { getIndustryPulse } from "../../services/insightService";
import { getOverview } from "../../services/analyticsService";
import useRailData from "../../hooks/useAsyncData";

// Each rail card loads its own data and quietly disappears when there is nothing useful to show:
// the feed never waits for it and never breaks because of it.

function RailCard({ title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="flex items-center gap-2 text-sm text-ink font-display">
          {Icon && <Icon className="h-4 w-4 text-ink/45" strokeWidth={1.9} aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

const RailLink = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-ink/55 transition-colors hover:text-brand">
    {children}<ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
  </Link>
);

function RailSkeleton({ rows = 3 }) {
  return (
    <div className="card space-y-3 p-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3"><Skeleton className="h-9 w-9 !rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
      ))}
    </div>
  );
}

// ======================= left: who you are on the platform =======================

export function ProfileSummaryCard({ profile }) {
  const analytics = useRailData(() => getOverview(30));
  if (!profile) return <RailSkeleton rows={2} />;

  const completion = profileCompletion(profile);
  const totals = analytics.data?.totals;

  return (
    <section className="card overflow-hidden" aria-label="Your profile">
      <div className="h-14 bg-brand" aria-hidden="true" />
      <div className="-mt-8 px-4 pb-4">
        <Link to="/profile" className="inline-block rounded-full ring-4 ring-white">
          <Avatar photoUrl={profile.profile_photo} fullName={profile.full_name} size={64} />
        </Link>
        <Link to="/profile" className="mt-2 flex flex-wrap items-center gap-1.5 text-[15px] text-ink font-display hover:text-brand">
          {profile.full_name}
          {isVerifiedAlumni({ is_verified_alumni: profile.role === "ALUMNI" }) && <VerifiedBadge compact />}
        </Link>
        {headline(profile) && <p className="text-[13px] leading-snug text-ink/70">{headline(profile)}</p>}
        <p className="mt-0.5 text-xs text-ink/50">{academicLine(profile) || (profile.role === "ALUMNI" ? "SRMS alumnus" : "SRMS student")}</p>
      </div>

      {completion.percent < 100 && completion.next && (
        <Link to="/profile" className="block border-t border-ink/8 px-4 py-3 transition-colors hover:bg-ink/[0.03]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink/75">Profile strength</span>
            <span className="tabular-nums font-semibold text-ink">{completion.percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/8" role="img" aria-label={`Profile ${completion.percent}% complete`}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${completion.percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink/55">Next: <span className="font-medium text-accent-700">{completion.next.label}</span></p>
        </Link>
      )}

      {totals && (
        <dl className="border-t border-ink/8 px-2 py-1.5 text-[13px]">
          {[
            { to: "/analytics#viewers", icon: Eye, label: "Profile viewers", value: totals.profile_viewers.value },
            { to: "/analytics#posts", icon: BarChart3, label: "Post impressions", value: totals.post_impressions.value },
          ].map(({ to, icon: Icon, label, value }) => (
            <Link key={label} to={to} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-ink/65 transition-colors hover:bg-ink/[0.04] hover:text-ink">
              <dt className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.9} aria-hidden="true" />{label}</dt>
              <dd className="tabular-nums font-semibold text-brand">{formatCount(value)}</dd>
            </Link>
          ))}
        </dl>
      )}
    </section>
  );
}

export function QuickLinksCard({ role }) {
  const links = [
    { to: "/network", icon: Users, label: "My network" },
    { to: "/mentorship", icon: Compass, label: role === "ALUMNI" ? "Mentor students" : "Find a mentor" },
    { to: role === "ALUMNI" ? "/jobs?mine=true" : "/career", icon: role === "ALUMNI" ? Briefcase : Bookmark, label: role === "ALUMNI" ? "Jobs I posted" : "My career requests" },
    { to: "/skill-gap", icon: TrendingUp, label: "My skill gap" },
  ];
  return (
    <nav aria-label="Shortcuts" className="card p-2">
      {links.map(({ to, icon: Icon, label }) => (
        <Link key={to} to={to} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-ink">
          <Icon className="h-4 w-4 text-ink/40" strokeWidth={1.9} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

// ======================= Campus Spotlight =======================

// One curated announcement from the college: banner or date tile, what, when, where, one action.
export function SpotlightItem({ spotlight, compact = false }) {
  const badge = dateBadge(spotlight.starts_at);
  const when = whenLabel(spotlight.starts_at, spotlight.ends_at);
  const where = whereLabel(spotlight);
  const hasLink = spotlight.cta_label && isSafeHttpsUrl(spotlight.cta_url);
  const hasImage = isSafeHttpsUrl(spotlight.image_url);

  return (
    <article className={compact ? "card flex h-full w-[280px] shrink-0 snap-start flex-col overflow-hidden" : "py-3.5 first:pt-0 last:pb-0"}>
      {hasImage && <img src={spotlight.image_url} alt="" loading="lazy" className={`${compact ? "h-28" : "mb-3 h-28 rounded-lg"} w-full object-cover`} />}
      <div className={`flex gap-3 ${compact ? "flex-1 p-4" : ""}`}>
        {badge && !hasImage && (
          <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-ink/10 bg-white text-center" aria-hidden="true">
            <span className="text-[9px] font-bold tracking-wider text-danger">{badge.month}</span>
            <span className="text-lg leading-none text-ink font-display">{badge.day}</span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="eyebrow !text-accent-700">{categoryLabel(spotlight.category)}</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-ink">{spotlight.title}</h3>
          <p className={`mt-1 text-[13px] leading-relaxed text-ink/65 ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{spotlight.description}</p>
          {(when || where) && (
            <ul className="mt-2 space-y-1 text-xs text-ink/60">
              {when && <li className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={1.9} aria-hidden="true" />{when}</li>}
              {where && (
                <li className="flex items-center gap-1.5">
                  {spotlight.is_online ? <Video className="h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={1.9} aria-hidden="true" /> : <MapPin className="h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={1.9} aria-hidden="true" />}
                  <span className="truncate">{where}</span>
                </li>
              )}
            </ul>
          )}
          {hasLink && (
            <a href={spotlight.cta_url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-600 ${compact ? "mt-auto pt-3" : "mt-2.5"}`}>
              {spotlight.cta_label}<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function CampusSpotlightCard({ state }) {
  if (state.status === "loading") return <RailSkeleton rows={2} />;
  const spotlights = state.data || [];
  if (spotlights.length === 0) return null;
  return (
    <RailCard title="Campus Spotlight" icon={Megaphone}>
      <p className="-mt-1.5 mb-3 text-xs text-ink/50">From the college, for the SRMS community</p>
      <div className="divide-y divide-ink/8">
        {spotlights.slice(0, 3).map((s) => <SpotlightItem key={s.id} spotlight={s} />)}
      </div>
    </RailCard>
  );
}

// ======================= people you may know =======================

export function PeopleYouMayKnowCard({ showToast }) {
  const state = useRailData(getSuggestions);
  const [sent, setSent] = useState({});
  const [sending, setSending] = useState(null);

  if (state.status === "loading") return <RailSkeleton rows={3} />;
  const people = (state.data || []).slice(0, 5);
  if (people.length === 0) return null;

  const connect = async (person) => {
    setSending(person.user_id);
    try {
      await sendConnectionRequest(person.user_id);
      setSent((s) => ({ ...s, [person.user_id]: true }));
    } catch (err) {
      showToast?.(err?.response?.data?.message || "Couldn't send request.", "error");
    } finally {
      setSending(null);
    }
  };

  return (
    <RailCard title="People you may know" icon={UserPlus} action={<RailLink to="/alumni">Directory</RailLink>}>
      <ul className="space-y-3.5">
        {people.map((person) => (
          <li key={person.user_id} className="flex items-start gap-3">
            <Link to={`/profile/${person.user_id}`}><Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={40} /></Link>
            <div className="min-w-0 flex-1">
              <Link to={`/profile/${person.user_id}`} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink hover:text-brand">
                <span className="truncate">{person.full_name}</span>
                {person.is_verified_alumni && <VerifiedBadge compact />}
              </Link>
              <p className="truncate text-xs text-ink/60">{headline(person) || academicLine(person)}</p>
              <p className="mt-0.5 text-[11px] text-ink/45">{suggestionReason(person)}</p>
            </div>
            <Button variant={sent[person.user_id] ? "ghost" : "secondary"} size="sm" disabled={Boolean(sent[person.user_id])} loading={sending === person.user_id} onClick={() => connect(person)} aria-label={`Connect with ${person.full_name}`} className="!h-7 !px-2.5 !text-xs">
              {sent[person.user_id] ? "Pending" : "Connect"}
            </Button>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

// ======================= opportunities and trends =======================

export function OpportunitiesCard() {
  const state = useRailData(() => listJobs({}, 1, 3));
  if (state.status === "loading") return <RailSkeleton rows={3} />;
  const jobs = state.data?.jobs || [];
  if (jobs.length === 0) return null;

  return (
    <RailCard title="Career opportunities" icon={Briefcase} action={<RailLink to="/jobs">All jobs</RailLink>}>
      <ul className="divide-y divide-ink/8">
        {jobs.map((job) => (
          <li key={job.id} className="py-2.5 first:pt-0 last:pb-0">
            <Link to={`/jobs/${job.id}`} className="group block">
              <p className="text-[13.5px] font-semibold leading-snug text-ink group-hover:text-brand">{job.title}</p>
              <p className="text-xs text-ink/65">{job.company} · {job.location}</p>
              <p className="mt-0.5 text-[11px] text-ink/45">{jobTypeLabel(job.job_type)} · {experienceLabel(job.experience_min, job.experience_max)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

const TREND_MARK = { up: "▲", new: "●", down: "▼", flat: "–" };

export function TrendingSkillsCard() {
  const state = useRailData(getIndustryPulse);
  if (state.status === "loading") return <RailSkeleton rows={2} />;
  const pulse = state.data;
  const trending = (pulse?.trending_skills?.skills || []).filter((s) => s.direction === "up" || s.direction === "new").slice(0, 5);
  const skills = trending.length ? trending : (pulse?.demanded_skills || []).slice(0, 5);
  if (skills.length === 0) return null;

  return (
    <RailCard title={trending.length ? "Trending skills" : "Skills in demand"} icon={TrendingUp} action={<RailLink to="/industry-pulse">Insights</RailLink>}>
      <ol className="space-y-2">
        {skills.map((skill, i) => (
          <li key={skill.skill_key || skill.skill} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-ink/85"><span className="w-3 text-xs tabular-nums text-ink/35">{i + 1}</span><span className="truncate font-medium">{skill.skill}</span></span>
            <span className="shrink-0 text-xs tabular-nums text-ink/55">
              {trending.length ? <><span className={skill.direction === "down" ? "text-danger-700" : "text-success-700"} aria-hidden="true">{TREND_MARK[skill.direction] || ""}</span> {skill.recent} {skill.recent === 1 ? "job" : "jobs"}</> : `${skill.count} ${skill.count === 1 ? "job" : "jobs"}`}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-ink/45">From jobs posted on SRMS Connect, not the wider market.</p>
    </RailCard>
  );
}

export function RailFooter() {
  return (
    <p className="px-1 text-[11px] leading-relaxed text-ink/40">
      SRMS Connect · The verified alumni network and career platform of SRMS.
    </p>
  );
}
