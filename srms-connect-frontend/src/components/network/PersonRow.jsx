import Avatar from "./Avatar";

// who a connection / request is: shared by both network cards
export default function PersonRow({ profile, onClick }) {
  const work = [profile.designation, profile.company].filter(Boolean).join(" at ");
  return (
    <button onClick={onClick} className="group flex min-w-0 flex-1 items-center gap-3.5 text-left">
      <Avatar src={profile.profile_photo} name={profile.full_name} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-ink group-hover:text-brand">{profile.full_name || "SRMS Member"}</span>
        {work && <span className="block truncate text-[13px] text-ink/65">{work}</span>}
        {profile.location && <span className="block truncate text-xs text-ink/45">{profile.location}</span>}
      </span>
    </button>
  );
}
