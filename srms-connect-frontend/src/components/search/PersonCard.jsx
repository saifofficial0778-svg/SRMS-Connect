import { useNavigate } from "react-router-dom";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import OpenToChips from "../ui/OpenToChips";
import { academicLine, headline, isVerifiedAlumni } from "../../utils/personFormat";

const MAX_SKILLS = 4;

export default function PersonCard({ person }) {
  const navigate = useNavigate();
  const { user_id, full_name, profile_photo, location, role, skills = [] } = person;

  const subtitle = headline(person);
  const academic = academicLine(person);
  const extraSkills = skills.length - MAX_SKILLS;

  return (
    <article className="flex flex-col rounded-2xl border border-[#1B2438]/10 bg-white p-5 hover:border-[#C98A2B]/40 hover:shadow-sm transition">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <Avatar photoUrl={profile_photo} fullName={full_name} size={56} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className="text-lg text-[#1B2438] truncate"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              {full_name}
            </h3>
            {isVerifiedAlumni(person) ? (
              <VerifiedBadge />
            ) : (
              role === "STUDENT" && (
                <span className="rounded-full bg-[#1B2438]/5 px-2 py-0.5 text-[11px] font-medium text-[#1B2438]/60">
                  Student
                </span>
              )
            )}
          </div>

          {subtitle && <p className="mt-0.5 text-sm text-[#1B2438]/80 truncate">{subtitle}</p>}
          {academic && <p className="text-xs text-[#1B2438]/55 truncate">{academic}</p>}
          {location && <p className="text-xs text-[#1B2438]/45 truncate">{location}</p>}
        </div>
      </div>

      {skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
          {skills.slice(0, MAX_SKILLS).map((skill) => (
            <li key={skill} className="rounded-full bg-[#1B2438]/5 px-2.5 py-1 text-xs text-[#1B2438]/70">
              {skill}
            </li>
          ))}
          {extraSkills > 0 && (
            <li className="rounded-full px-2 py-1 text-xs text-[#1B2438]/45">+{extraSkills}</li>
          )}
        </ul>
      )}

      <OpenToChips intents={person.open_to} className="mt-3" />

      <div className="mt-4 pt-4 border-t border-[#1B2438]/8 flex justify-end">
        <button
          onClick={() => navigate(`/profile/${user_id}`)}
          className="rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5 transition-colors"
        >
          View profile
        </button>
      </div>
    </article>
  );
}
