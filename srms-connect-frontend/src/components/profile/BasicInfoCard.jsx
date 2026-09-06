import {
  BriefcaseIcon,
  BuildingIcon,
  ClockIcon,
  CompassIcon,
  LocationIcon,
  QuoteIcon,
} from "./icons";

function Row({ icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-[#C98A2B]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[#1B2438]/50">{label}</p>
        <p className="text-sm text-[#1B2438] break-words">{value}</p>
      </div>
    </div>
  );
}

export default function BasicInfoCard({ profile }) {
  const {
    full_name,
    location,
    designation,
    company,
    experience_years,
    bio,
    interests,
    career_goals,
  } = profile;

  const hasAnything =
    full_name || location || designation || company || experience_years != null || bio;

  return (
    <section className="rounded-2xl border border-[#1B2438]/10 bg-white p-5 sm:p-6">
      <h2
        className="text-lg text-[#1B2438] border-l-4 border-[#3F6B52] pl-3"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        Basic information
      </h2>

      {!hasAnything ? (
        <p className="mt-4 text-sm text-[#1B2438]/50">
          Nothing added yet. Use "Edit profile" to fill this in.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-[#1B2438]/8">
          <Row icon={<BriefcaseIcon />} label="Full name" value={full_name} />
          <Row icon={<LocationIcon />} label="Location" value={location} />
          <Row icon={<BriefcaseIcon />} label="Designation" value={designation} />
          <Row icon={<BuildingIcon />} label="Company" value={company} />
          <Row
            icon={<ClockIcon />}
            label="Experience"
            value={
              experience_years != null
                ? `${experience_years} year${experience_years === 1 ? "" : "s"}`
                : null
            }
          />
          <Row icon={<QuoteIcon />} label="Bio" value={bio} />
          <Row icon={<CompassIcon />} label="Interests" value={interests} />
          <Row icon={<CompassIcon />} label="Career goals" value={career_goals} />
        </div>
      )}
    </section>
  );
}
