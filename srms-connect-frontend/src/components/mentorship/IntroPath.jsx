import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleDashed, UserRound, X } from "lucide-react";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import { headline } from "../../utils/personFormat";

// what the line between two people means in each state
const LINK_STATE = {
  made: { line: "bg-success", chip: "bg-success text-white", icon: Check, label: "Introduced" },
  open: { line: "bg-brand/30", chip: "bg-brand-50 text-brand ring-1 ring-brand/20", icon: ArrowRight, label: "Asked" },
  idle: { line: "bg-ink/15 [mask-image:repeating-linear-gradient(90deg,black_0_6px,transparent_6px_11px)]", chip: "bg-white text-ink/40 ring-1 ring-ink/15", icon: CircleDashed, label: "Waiting" },
  closed: { line: "bg-ink/15", chip: "bg-white text-ink/45 ring-1 ring-ink/15", icon: X, label: "Not made" },
};

function Connector({ state, vertical }) {
  const s = LINK_STATE[state];
  const Icon = s.icon;
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${vertical ? "h-10 w-full" : "h-full min-w-[2.5rem] flex-1"}`} role="img" aria-label={s.label}>
      <span className={`absolute ${vertical ? "left-1/2 h-full w-0.5 -translate-x-1/2 [mask-image:none]" : "top-1/2 h-0.5 w-full -translate-y-1/2"} rounded-full ${s.line}`} />
      <span className={`relative flex h-6 w-6 items-center justify-center rounded-full ${s.chip}`}>
        <Icon className={`h-3.5 w-3.5 ${vertical && state === "open" ? "rotate-90" : ""}`} strokeWidth={2.4} aria-hidden="true" />
      </span>
    </div>
  );
}

function Node({ person, caption, placeholder, highlight }) {
  const body = (
    <>
      {person ? (
        <Avatar photoUrl={person.profile_photo} fullName={person.full_name} size={52} />
      ) : (
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-ink/25 bg-white text-ink/35"><UserRound className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" /></span>
      )}
      <span className="mt-2 block text-[10.5px] font-semibold uppercase tracking-wider text-ink/45">{caption}</span>
      <span className="mt-0.5 flex items-center justify-center gap-1 text-[13.5px] font-semibold leading-tight text-ink">
        <span className="line-clamp-1">{person ? person.full_name : placeholder}</span>
        {person?.is_verified_alumni && <VerifiedBadge compact />}
      </span>
      {person && headline(person) && <span className="mt-0.5 line-clamp-1 text-xs text-ink/55">{headline(person)}</span>}
    </>
  );
  const cls = `flex w-full min-w-0 flex-col items-center rounded-lg px-2 py-3 text-center sm:w-40 ${highlight ? "bg-brand-50/70 ring-1 ring-brand/15" : ""}`;
  return person?.user_id ? <Link to={`/profile/${person.user_id}`} className={`${cls} transition-colors hover:bg-ink/[0.04]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

// The relationship path of a warm introduction, read left to right:
//   the student  ->  someone they both know  ->  the person they want to reach
// The first link is the request, the second is the introduction itself; each shows where it stands.
//   status: null (not asked yet) | PENDING | INTRODUCED | DECLINED | CANCELLED
//   me:     "requester" | "introducer" | "target" - whose card is highlighted as "You"
export default function IntroPath({ requester, introducer, target, status = null, me = "requester" }) {
  const asked = status === "INTRODUCED" ? "made" : status === "PENDING" ? "open" : status ? "closed" : "idle";
  const introduced = status === "INTRODUCED" ? "made" : status === "DECLINED" || status === "CANCELLED" ? "closed" : "idle";
  const caption = (role, fallback) => (me === role ? "You" : fallback);

  return (
    <div className="rounded-xl border border-ink/8 bg-canvas/70 p-3 sm:p-4" aria-label="Introduction path">
      <div className="flex flex-col items-stretch sm:flex-row sm:items-center">
        <Node person={requester} caption={caption("requester", "Student")} placeholder="You" highlight={me === "requester"} />
        <div className="hidden flex-1 sm:flex sm:h-16"><Connector state={asked} /></div>
        <div className="sm:hidden"><Connector state={asked} vertical /></div>
        <Node person={introducer} caption={caption("introducer", "Knows you both")} placeholder="Choose who introduces you" highlight={me === "introducer"} />
        <div className="hidden flex-1 sm:flex sm:h-16"><Connector state={introduced} /></div>
        <div className="sm:hidden"><Connector state={introduced} vertical /></div>
        <Node person={target} caption={caption("target", "Wants to reach")} placeholder="Alumnus" highlight={me === "target"} />
      </div>
    </div>
  );
}
