import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import OpenToChips from "../ui/OpenToChips";
import { Badge, Chip } from "../ui/Primitives";
import { academicLine, headline, isVerifiedAlumni } from "../../utils/personFormat";

const MAX_SKILLS = 4;

// A member in the directory: who they are, what they do, what they know and what they are open
// to - enough to decide whether to open the profile, and no more.
export default function PersonCard({ person }) {
  const { user_id, full_name, profile_photo, location, role, skills = [] } = person;
  const subtitle = headline(person);
  const academic = academicLine(person);
  const extraSkills = skills.length - MAX_SKILLS;
  const to = `/profile/${user_id}`;

  return (
    <article className="card group flex flex-col p-5 transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3.5">
        <Link to={to} tabIndex={-1} aria-hidden="true"><Avatar photoUrl={profile_photo} fullName={full_name} size={56} /></Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 truncate text-base text-ink font-display">
              <Link to={to} className="hover:text-brand">{full_name}</Link>
            </h3>
            {isVerifiedAlumni(person) ? <VerifiedBadge /> : role === "STUDENT" && <Badge label="Student" tone="neutral" />}
          </div>

          {subtitle && <p className="mt-0.5 truncate text-sm text-ink/80">{subtitle}</p>}
          {academic && <p className="truncate text-[13px] text-ink/55">{academic}</p>}
          {location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink/45">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.9} aria-hidden="true" />{location}
            </p>
          )}
        </div>
      </div>

      {skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
          {skills.slice(0, MAX_SKILLS).map((skill) => <li key={skill}><Chip>{skill}</Chip></li>)}
          {extraSkills > 0 && <li className="px-1 py-0.5 text-xs text-ink/45">+{extraSkills}</li>}
        </ul>
      )}

      <OpenToChips intents={person.open_to} className="mt-3" />

      <div className="mt-auto flex justify-end pt-4">
        <Link to={to} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand-600">
          View profile <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
