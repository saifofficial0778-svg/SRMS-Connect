import { Link } from "react-router-dom";
import { Briefcase, Building2, Clock3, MapPin } from "lucide-react";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import Button from "../ui/Button";
import { Badge, Chip } from "../ui/Primitives";
import { timeAgo } from "../feed/timeAgo";
import { experienceLabel, jobTypeLabel } from "../../utils/jobFormat";

const MAX_SKILLS = 5;

const Meta = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.9} aria-hidden="true" />{children}</span>
);

// One opening: role and company first, the facts people filter on next, then who posted it.
export default function JobCard({ job }) {
  const { id, title, company, location, job_type, experience_min, experience_max, status, created_at, description_preview, poster, is_owner } = job;
  const skills = job.skills || [];
  const extra = skills.length - MAX_SKILLS;
  const initial = String(company || "?").trim().charAt(0).toUpperCase();

  return (
    <article className="card group p-5 transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3.5">
        {/* a neutral company tile: there are no company logos in the data, so none are invented */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-canvas text-base text-ink/70 font-display" aria-hidden="true">{initial}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 text-base text-ink font-display">
              <Link to={`/jobs/${id}`} className="hover:text-brand">{title}</Link>
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {is_owner && <Badge label="Posted by you" tone="brand" />}
              {status === "CLOSED" && <Badge label="Closed" tone="neutral" />}
            </div>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink/70">
            <Meta icon={Building2}>{company}</Meta>
            <Meta icon={MapPin}>{location}</Meta>
            <Meta icon={Briefcase}>{jobTypeLabel(job_type)}</Meta>
            <Meta icon={Clock3}>{experienceLabel(experience_min, experience_max)}</Meta>
          </p>
        </div>
      </div>

      {description_preview && <p className="mt-3.5 text-sm leading-relaxed text-ink/65 line-clamp-2">{description_preview}</p>}

      {skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Required skills">
          {skills.slice(0, MAX_SKILLS).map((skill) => <li key={skill}><Chip>{skill}</Chip></li>)}
          {extra > 0 && <li className="px-1 py-0.5 text-xs text-ink/45">+{extra}</li>}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-3.5">
        <Link to={`/profile/${poster.user_id}`} className="flex min-w-0 items-center gap-2.5">
          <Avatar photoUrl={poster.profile_photo} fullName={poster.full_name} size={30} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
              <span className="truncate">{is_owner ? "You" : poster.full_name}</span>
              {poster.is_verified_alumni && <VerifiedBadge compact />}
            </span>
            <span className="block text-xs text-ink/45">Posted {timeAgo(created_at)}</span>
          </span>
        </Link>

        <Button variant="secondary" size="sm" to={`/jobs/${id}`}>View details</Button>
      </div>
    </article>
  );
}
