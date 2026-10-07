import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Sparkles, Users } from "lucide-react";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import Button from "../ui/Button";
import { Badge as UiBadge, Chip, EmptyState, Field as UiField, PageHeader as UiPageHeader, Pager as UiPager, SkeletonCard, Tabs, Textarea } from "../ui/Primitives";
import { headline } from "../../utils/personFormat";
import { canRequestMentor, spotsLabel, topicLabel } from "../../utils/mentorshipFormat";

// The mentorship pages were written against these names; they are now thin layers over the
// shared design-system components, so every page of the product looks the same.

export function Badge({ label, tone = "muted" }) {
  return <UiBadge label={label} tone={tone} />;
}

// sub-navigation shared by every mentorship page
export function MentorshipTabs() {
  // the mentor profile is for alumni; the server refuses anyone else regardless of this link
  const isAlumni = localStorage.getItem("role") === "ALUMNI";
  const tabs = [
    { to: "/mentorship", label: "Find mentors", end: true },
    { to: "/mentorship/dashboard", label: "My mentorships" },
    { to: "/mentorship/intros", label: "Introductions" },
    ...(isAlumni ? [{ to: "/mentorship/profile", label: "Mentor profile" }] : []),
  ];
  return <Tabs tabs={tabs} label="Mentorship" />;
}

export function PageHeader({ title, subtitle }) {
  return (
    <UiPageHeader eyebrow="Mentorship" title={title} subtitle={subtitle}>
      <MentorshipTabs />
    </UiPageHeader>
  );
}

export function Field(props) {
  return <UiField {...props} />;
}

// Why a mentor is recommended: the score as a bar out of its maximum, then every rule that
// contributed with the points it gave. Nothing about the match is hidden.
export function MatchReasons({ match, compact = false }) {
  if (!match) return null;
  const percent = Math.max(0, Math.min(100, Number(match.percent) || 0));
  return (
    <div className={compact ? "" : "rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3.5"}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Why this mentor
        </p>
        <p className="text-[13px] tabular-nums text-ink/70">
          <span className="font-semibold text-ink">{match.score}</span> of {match.max_score} points
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-100" role="img" aria-label={`Match ${percent}%`}>
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      {match.reasons.length === 0 ? (
        <p className="mt-2.5 text-xs text-ink/55">None of the matching rules apply yet. Add skills to your profile or choose a topic.</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {match.reasons.map((reason) => (
            <li key={reason.code} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink/75">
              <span className="mt-px w-9 shrink-0 rounded bg-white px-1 text-center text-xs font-semibold tabular-nums text-success-700 ring-1 ring-ink/8">+{reason.points}</span>
              <span>{reason.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TopicChips({ topics = [], className = "" }) {
  if (!topics.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Mentorship topics">
      {topics.map((topic) => (
        <li key={topic}><Chip tone="accent">{topicLabel(topic)}</Chip></li>
      ))}
    </ul>
  );
}

export function MentorCard({ mentor }) {
  const skills = mentor.skills || [];
  const open = canRequestMentor(mentor);
  return (
    <article className="card group flex flex-col p-5 transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3.5">
        <Avatar photoUrl={mentor.profile_photo} fullName={mentor.full_name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base text-ink font-display">
              <Link to={`/mentorship/mentors/${mentor.user_id}`} className="hover:text-brand">{mentor.full_name}</Link>
            </h3>
            {mentor.is_verified_alumni && <VerifiedBadge compact />}
          </div>
          {headline(mentor) && <p className="truncate text-sm text-ink/70">{headline(mentor)}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/55">
            <span className={`inline-flex items-center gap-1 ${open ? "text-success-700" : ""}`}>
              <Users className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />{spotsLabel(mentor)}
            </span>
            {mentor.availability && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />{mentor.availability}</span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-3.5 text-sm leading-relaxed text-ink/70 line-clamp-2">{mentor.bio}</p>
      <TopicChips topics={mentor.topics} className="mt-3" />

      {skills.length > 0 && (
        <p className="mt-2.5 text-xs text-ink/55">
          <span className="font-medium text-ink/70">Expertise</span> · {skills.slice(0, 6).join(", ")}{skills.length > 6 ? ` +${skills.length - 6}` : ""}
        </p>
      )}

      {mentor.match && <div className="mt-4"><MatchReasons match={mentor.match} /></div>}

      <div className="mt-auto flex justify-end pt-4">
        <Button variant="secondary" size="sm" to={`/mentorship/mentors/${mentor.user_id}`}>
          View mentor <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

export function PersonLine({ person, verified = false, note }) {
  return (
    <Link to={`/profile/${person.user_id}`} className="group flex items-center gap-3">
      <Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={40} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink group-hover:text-brand">
          {person.full_name}
          {verified && <VerifiedBadge compact />}
        </span>
        <span className="block truncate text-xs text-ink/55">
          {note || headline(person) || [person.branch, person.batch_year && `Batch ${person.batch_year}`].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );
}

const ACTION_VARIANT = { primary: "primary", danger: "dangerSolid", secondary: "secondary" };

// "press the button, optionally add a note, confirm" - used for accept / decline / complete / introduce
export function ActionWithNote({ meta, busy, onSubmit, onBack }) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
      className="mt-6 rounded-lg border border-ink/10 bg-canvas/70 p-4"
    >
      {meta.note !== "none" && (
        <UiField label={meta.noteLabel}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} autoFocus />
        </UiField>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>Back</Button>
        <Button type="submit" variant={ACTION_VARIANT[meta.tone] || "primary"} loading={busy}>{meta.label}</Button>
      </div>
    </form>
  );
}

export function LoadingCard() {
  return <SkeletonCard avatar lines={3} />;
}

export function EmptyCard({ title, children }) {
  return <EmptyState title={title}>{children}</EmptyState>;
}

export function Pager(props) {
  return <UiPager {...props} />;
}
