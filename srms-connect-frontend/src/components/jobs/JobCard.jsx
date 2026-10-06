import { Link } from "react-router-dom";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import { timeAgo } from "../feed/timeAgo";
import { experienceLabel, jobSubtitle, jobTypeLabel } from "../../utils/jobFormat";

const MAX_SKILLS = 5;

export default function JobCard({ job }) {
  const { id, title, job_type, experience_min, experience_max, status, created_at, description_preview, poster, is_owner } = job;
  const skills = job.skills || [];
  const extra = skills.length - MAX_SKILLS;

  return (
    <article className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 hover:border-[#C98A2B]/40 hover:shadow-sm transition">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            <Link to={`/jobs/${id}`} className="hover:text-[#9F6C1E] focus:outline-none focus-visible:underline">
              {title}
            </Link>
          </h3>
          <p className="text-sm text-[#1B2438]/70">{jobSubtitle(job)}</p>
        </div>

        {status === "CLOSED" && (
          <span className="rounded-full bg-[#1B2438]/10 px-2.5 py-0.5 text-xs font-medium text-[#1B2438]/60">Closed</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[#1B2438]/5 px-2.5 py-1 font-medium text-[#1B2438]/70">{jobTypeLabel(job_type)}</span>
        <span className="rounded-full bg-[#1B2438]/5 px-2.5 py-1 text-[#1B2438]/70">
          {experienceLabel(experience_min, experience_max)}
        </span>
      </div>

      {description_preview && (
        <p className="mt-3 text-sm leading-relaxed text-[#1B2438]/65 line-clamp-2">{description_preview}</p>
      )}

      {skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Required skills">
          {skills.slice(0, MAX_SKILLS).map((skill) => (
            <li key={skill} className="rounded-full border border-[#1B2438]/10 px-2.5 py-0.5 text-xs text-[#1B2438]/70">
              {skill}
            </li>
          ))}
          {extra > 0 && <li className="px-1.5 py-0.5 text-xs text-[#1B2438]/45">+{extra}</li>}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#1B2438]/8 pt-4">
        <Link to={`/profile/${poster.user_id}`} className="flex min-w-0 items-center gap-2.5">
          <Avatar photoUrl={poster.profile_photo} fullName={poster.full_name} size={32} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[#1B2438]">
              <span className="truncate">{is_owner ? "You" : poster.full_name}</span>
              {poster.is_verified_alumni && <VerifiedBadge />}
            </span>
            <span className="block text-xs text-[#1B2438]/45">Posted {timeAgo(created_at)}</span>
          </span>
        </Link>

        <Link
          to={`/jobs/${id}`}
          className="rounded-lg border border-[#1B2438]/15 px-4 py-2 text-sm font-medium text-[#1B2438]/80 hover:bg-[#1B2438]/5 transition-colors"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
