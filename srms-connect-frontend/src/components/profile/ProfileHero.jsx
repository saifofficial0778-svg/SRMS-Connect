import { GraduationCap, MapPin } from "lucide-react";
import VerifiedBadge from "../ui/VerifiedBadge";
import { Badge } from "../ui/Primitives";

const Meta = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.8} aria-hidden="true" />{children}</span>
);

// The top of a profile - the same structure for your own profile and for someone else's:
// a quiet brand band, the photo, the name and career identity, then one row of actions.
//   avatar    the photo (own profile passes an editable one)
//   actions   buttons on the right (Edit profile / Connect / Message ...)
//   children  extra lines under the identity (Open to, ways to ask for help)
export default function ProfileHero({ avatar, name, role, verified, work, academic, location, bio, actions, children }) {
  return (
    <section className="card overflow-hidden">
      <div className="relative h-24 bg-brand sm:h-28" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-accent/60" />
      </div>

      <div className="px-5 pb-6 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative -mt-12 shrink-0 self-start rounded-full ring-4 ring-white sm:-mt-14">{avatar}</div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-1 sm:pb-1">{actions}</div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="text-2xl text-ink font-display sm:text-[28px]">{name}</h1>
            {verified ? <VerifiedBadge /> : role === "STUDENT" ? <Badge label="Student" tone="neutral" /> : null}
          </div>
          {work && <p className="mt-1 text-[15px] text-ink/85">{work}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink/60">
            {academic && <Meta icon={GraduationCap}>{academic}</Meta>}
            {location && <Meta icon={MapPin}>{location}</Meta>}
          </p>
          {children}
        </div>

        {bio && (
          <div className="mt-5 border-t border-ink/8 pt-4">
            <h2 className="eyebrow">About</h2>
            {/* user-written text is always rendered as text, never as HTML */}
            <p className="mt-1.5 max-w-3xl whitespace-pre-wrap text-[15px] leading-relaxed text-ink/80">{bio}</p>
          </div>
        )}
      </div>
    </section>
  );
}
