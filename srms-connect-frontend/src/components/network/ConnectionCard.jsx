import { useState } from "react";
import Avatar from "./Avatar";

export default function ConnectionCard({ profile, onMessage, onRemove, onViewProfile }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    setRemoving(true);
    try {
      await onRemove();
    } catch {
      setRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#1B2438]/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-sm transition-shadow">
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

      {confirming ? (
        <div className="flex items-center gap-2 shrink-0 bg-red-50 rounded-lg px-3 py-2">
          <span className="text-xs text-red-700 hidden sm:inline">
            Remove {profile.full_name || "this connection"}?
          </span>
          <button
            onClick={handleConfirmRemove}
            disabled={removing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={removing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#1B2438]/60 hover:bg-white transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onMessage}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1B2438]/15 text-[#1B2438] hover:bg-[#1B2438]/5 transition-colors"
          >
            Message
          </button>
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#1B2438]/60 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}