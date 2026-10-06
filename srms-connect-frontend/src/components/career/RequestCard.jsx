import { Link } from "react-router-dom";
import Avatar from "../profile/Avatar";
import VerifiedBadge from "../ui/VerifiedBadge";
import StatusBadge from "./StatusBadge";
import { timeAgo } from "../feed/timeAgo";
import { counterpart, jobLine, requestTitle, typeMeta } from "../../utils/careerFormat";

export default function RequestCard({ request }) {
  const other = counterpart(request);
  const needsYou = request.direction === "received" && request.status === "PENDING";

  return (
    <article
      className={`rounded-2xl border bg-white p-5 transition hover:shadow-sm ${
        needsYou ? "border-[#C98A2B]/50" : "border-[#1B2438]/10 hover:border-[#C98A2B]/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0">
          <Avatar photoUrl={other.profile_photo} fullName={other.full_name} size={44} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-medium text-[#1B2438]">
              <Link to={`/career/requests/${request.id}`} className="hover:text-[#9F6C1E] focus:outline-none focus-visible:underline">
                {requestTitle(request)}
              </Link>
            </h3>
            <StatusBadge status={request.status} />
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#1B2438]/55">
            <span className="rounded-full bg-[#1B2438]/5 px-2 py-0.5 font-medium text-[#1B2438]/65">{typeMeta(request.type).label}</span>
            {request.direction === "sent" && request.alumni.is_verified_alumni && <VerifiedBadge />}
            <span>{timeAgo(request.created_at)}</span>
          </p>

          {request.job && (
            <p className="mt-2 text-sm text-[#1B2438]/75">
              For <span className="font-medium">{jobLine(request.job)}</span>
              {request.job.status !== "OPEN" && <span className="text-[#1B2438]/45"> (no longer open)</span>}
            </p>
          )}

          <p className="mt-2 text-sm leading-relaxed text-[#1B2438]/65 line-clamp-2">{request.message}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#1B2438]/8 pt-3">
        <span className="text-xs text-[#1B2438]/45">
          {needsYou ? "Waiting for your reply" : request.response ? "Has a reply" : ""}
        </span>
        <Link
          to={`/career/requests/${request.id}`}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            needsYou
              ? "bg-[#C98A2B] text-white hover:bg-[#B37A22]"
              : "border border-[#1B2438]/15 text-[#1B2438]/80 hover:bg-[#1B2438]/5"
          }`}
        >
          {needsYou ? "Respond" : "View"}
        </Link>
      </div>
    </article>
  );
}
