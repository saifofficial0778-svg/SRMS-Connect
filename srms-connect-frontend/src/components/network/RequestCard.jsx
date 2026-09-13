import { useState } from "react";
import Avatar from "./Avatar";

export default function RequestCard({ type, profile, onAccept, onReject, onCancel, onViewProfile }) {
  const [loadingAction, setLoadingAction] = useState(null);

  const run = async (action, fn) => {
    setLoadingAction(action);
    try {
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#1B2438]/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <button onClick={onViewProfile} className="flex items-center gap-4 text-left flex-1 min-w-0">
        <Avatar src={profile.profile_photo} name={profile.full_name} />
        <div className="min-w-0">
          <p className="font-semibold text-[#1B2438] truncate">
            {profile.full_name || "SRMS Member"}
          </p>
          {(profile.designation || profile.company) && (
            <p className="text-sm text-[#1B2438]/65 truncate">
              {[profile.designation, profile.company].filter(Boolean).join(" at ")}
            </p>
          )}
          {profile.location && (
            <p className="text-xs text-[#1B2438]/45 truncate mt-0.5">{profile.location}</p>
          )}
        </div>
      </button>

      {type === "received" ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => run("reject", onReject)}
            disabled={!!loadingAction}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1B2438]/15 text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-60 transition-colors"
          >
            {loadingAction === "reject" ? "Rejecting..." : "Reject"}
          </button>
          <button
            onClick={() => run("accept", onAccept)}
            disabled={!!loadingAction}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C98A2B] text-white hover:bg-[#b57a22] disabled:opacity-60 transition-colors"
          >
            {loadingAction === "accept" ? "Accepting..." : "Accept"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-medium text-[#1B2438]/50 bg-[#1B2438]/5 px-2.5 py-1 rounded-full">
            Pending
          </span>
          <button
            onClick={() => run("cancel", onCancel)}
            disabled={!!loadingAction}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1B2438]/15 text-[#1B2438]/70 hover:bg-[#1B2438]/5 disabled:opacity-60 transition-colors"
          >
            {loadingAction === "cancel" ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
}