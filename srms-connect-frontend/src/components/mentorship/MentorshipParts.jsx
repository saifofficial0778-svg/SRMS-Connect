import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import { headline } from "../../utils/personFormat";
import { matchSummary, spotsLabel, topicLabel } from "../../utils/mentorshipFormat";
import { BUTTON_TONES, inputClass } from "./mentorshipStyles";

const TONES = {
  pending: "bg-[#C98A2B]/10 text-[#9F6C1E]",
  positive: "bg-[#3F6B52]/10 text-[#2F5340]",
  negative: "bg-red-50 text-red-700",
  muted: "bg-[#1B2438]/8 text-[#1B2438]/60",
};

// status badge: the label carries the meaning, the colour only supports it
export function Badge({ label, tone = "muted" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone] || TONES.muted}`}>
      {label}
    </span>
  );
}

const tabClass = ({ isActive }) =>
  `rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
    isActive ? "bg-white text-[#1B2438] shadow-sm" : "text-[#1B2438]/55 hover:text-[#1B2438]"
  }`;

// sub-navigation shared by every mentorship page
export function MentorshipTabs() {
  // the mentor profile is for alumni; the server refuses anyone else regardless of this link
  const isAlumni = localStorage.getItem("role") === "ALUMNI";
  return (
    <nav aria-label="Mentorship" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-[#1B2438]/5 p-1">
      <NavLink to="/mentorship" end className={tabClass}>Find mentors</NavLink>
      <NavLink to="/mentorship/dashboard" className={tabClass}>My mentorships</NavLink>
      <NavLink to="/mentorship/intros" className={tabClass}>Introductions</NavLink>
      {isAlumni && <NavLink to="/mentorship/profile" className={tabClass}>Mentor profile</NavLink>}
    </nav>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#1B2438]/60">{subtitle}</p>}
      </div>
      <MentorshipTabs />
    </header>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#1B2438]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-[#1B2438]/45">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// why a mentor was recommended: every point is listed with its reason
export function MatchReasons({ match, compact = false }) {
  if (!match) return null;
  return (
    <div className={compact ? "" : "rounded-xl bg-[#1B2438]/[0.03] px-4 py-3"}>
      <p className="text-sm font-medium text-[#1B2438]">
        Match: <span className="tabular-nums">{matchSummary(match)}</span>
      </p>
      {match.reasons.length === 0 ? (
        <p className="mt-1 text-xs text-[#1B2438]/55">None of the matching rules apply yet.</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5">
          {match.reasons.map((reason) => (
            <li key={reason.code} className="flex gap-2 text-xs text-[#1B2438]/70">
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-[#2F5340]">+{reason.points}</span>
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
        <li key={topic} className="rounded-full border border-[#C98A2B]/40 bg-[#C98A2B]/[0.08] px-2.5 py-0.5 text-xs font-medium text-[#9F6C1E]">
          {topicLabel(topic)}
        </li>
      ))}
    </ul>
  );
}

export function MentorCard({ mentor }) {
  const skills = mentor.skills || [];
  return (
    <article className="flex flex-col rounded-2xl border border-[#1B2438]/10 bg-white p-5 transition hover:border-[#C98A2B]/40 hover:shadow-sm">
      <div className="flex items-start gap-4">
        <span className="shrink-0"><Avatar photoUrl={mentor.profile_photo} fullName={mentor.full_name} size={52} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              <Link to={`/mentorship/mentors/${mentor.user_id}`} className="hover:text-[#9F6C1E] focus:outline-none focus-visible:underline">
                {mentor.full_name}
              </Link>
            </h3>
            {mentor.is_verified_alumni && <VerifiedBadge />}
          </div>
          {headline(mentor) && <p className="text-sm text-[#1B2438]/75">{headline(mentor)}</p>}
          <p className="text-xs text-[#1B2438]/50">{spotsLabel(mentor)} · {mentor.availability}</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#1B2438]/65 line-clamp-2">{mentor.bio}</p>
      <TopicChips topics={mentor.topics} className="mt-3" />

      {skills.length > 0 && (
        <p className="mt-2 text-xs text-[#1B2438]/55">
          Skills: {skills.slice(0, 6).join(", ")}{skills.length > 6 ? ` +${skills.length - 6}` : ""}
        </p>
      )}

      {mentor.match && <div className="mt-3"><MatchReasons match={mentor.match} /></div>}

      <div className="mt-4 flex justify-end border-t border-[#1B2438]/8 pt-4">
        <Link to={`/mentorship/mentors/${mentor.user_id}`} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${BUTTON_TONES.secondary}`}>
          View mentor
        </Link>
      </div>
    </article>
  );
}

export function PersonLine({ person, verified = false, note }) {
  return (
    <Link to={`/profile/${person.user_id}`} className="flex items-center gap-3">
      <Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={40} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#1B2438]">
          {person.full_name}
          {verified && <VerifiedBadge />}
        </span>
        <span className="block text-xs text-[#1B2438]/55">
          {note || headline(person) || [person.branch, person.batch_year && `Batch ${person.batch_year}`].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );
}

// "press the button, optionally add a note, confirm" - used for accept / decline / complete / introduce
export function ActionWithNote({ meta, busy, onSubmit, onBack }) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
      className="mt-6 border-t border-[#1B2438]/8 pt-5"
    >
      {meta.note !== "none" && (
        <Field label={meta.noteLabel}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} autoFocus className={inputClass} />
        </Field>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        <button type="button" onClick={onBack} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES.secondary}`}>
          Back
        </button>
        <button type="submit" disabled={busy} className={`rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-60 ${BUTTON_TONES[meta.tone]}`}>
          {busy ? "Saving..." : meta.label}
        </button>
      </div>
    </form>
  );
}

export function LoadingCard() {
  return (
    <div className="rounded-2xl border border-[#1B2438]/10 bg-white p-8 animate-pulse space-y-3" aria-busy="true">
      <div className="h-6 w-1/2 rounded bg-[#1B2438]/10" />
      <div className="h-4 w-1/3 rounded bg-[#1B2438]/8" />
      <div className="h-20 w-full rounded bg-[#1B2438]/5" />
    </div>
  );
}

export function EmptyCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#1B2438]/10 bg-white py-12 px-6 text-center">
      <p className="font-medium text-[#1B2438]">{title}</p>
      {children && <div className="mt-1 text-sm text-[#1B2438]/55">{children}</div>}
    </div>
  );
}

export function Pager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const button = "rounded-lg border border-[#1B2438]/15 bg-white px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5 disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={button}>Previous</button>
      <span className="text-sm text-[#1B2438]/60">Page {page} of {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={button}>Next</button>
    </nav>
  );
}
