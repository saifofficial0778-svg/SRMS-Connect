import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPublicProfileById } from "../../services/profileService";
import Avatar from "../../components/network/Avatar";

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getPublicProfileById(userId);
        if (!cancelled) setProfile(res?.data || null);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Unable to load this profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse space-y-4">
        <div className="h-28 w-28 rounded-full bg-[#1B2438]/10" />
        <div className="h-6 w-48 rounded bg-[#1B2438]/10" />
        <div className="h-4 w-72 rounded bg-[#1B2438]/8" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-[#1B2438]/70">{error || "Profile not found."}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm font-medium text-[#C98A2B] hover:underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl border border-[#1B2438]/10 p-8 flex flex-col sm:flex-row gap-6 items-start">
        <Avatar src={profile.profile_photo} name={profile.full_name} size="h-24 w-24 text-xl" />
        <div className="min-w-0">
          <h1 className="text-2xl text-[#1B2438]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            {profile.full_name || "SRMS Member"}
          </h1>
          {(profile.designation || profile.company) && (
            <p className="mt-1 text-[#1B2438]/70">
              {[profile.designation, profile.company].filter(Boolean).join(" at ")}
            </p>
          )}
          {profile.location && <p className="mt-0.5 text-sm text-[#1B2438]/50">{profile.location}</p>}
          {profile.bio && <p className="mt-4 text-sm text-[#1B2438]/75 leading-relaxed">{profile.bio}</p>}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {profile.linkedin_url && (
              <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-[#C98A2B] hover:underline">
                LinkedIn
              </a>
            )}
            {profile.github_url && (
              <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-[#C98A2B] hover:underline">
                GitHub
              </a>
            )}
            {profile.portfolio_url && (
              <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className="text-[#C98A2B] hover:underline">
                Portfolio
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}