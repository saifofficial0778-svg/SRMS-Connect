import { GithubIcon, LinkIcon, LinkedInIcon, ResumeIcon } from "./icons";

const LINKS = [
  { key: "linkedin_url", label: "LinkedIn", icon: LinkedInIcon },
  { key: "github_url", label: "GitHub", icon: GithubIcon },
  { key: "portfolio_url", label: "Portfolio", icon: LinkIcon },
  // resume_url isn't in the original brief's link list, but it's a real
  // field on updateProfileSchema, so it's surfaced here rather than dropped.
  { key: "resume_url", label: "Resume", icon: ResumeIcon },
];

export default function SocialLinks({ profile }) {
  const available = LINKS.filter((l) => profile[l.key]);

  if (!available.length) return null;

  return (
    <section className="card p-5 sm:p-6">
      <h2
        className="text-lg text-ink border-l-4 border-success pl-3 font-display"
      >
        Links
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {available.map(({ key, label, icon: Icon }) => (
          <a
            key={key}
            href={profile[key]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-ink/12 px-4 py-2 text-sm text-ink hover:border-accent hover:text-accent-700 transition-colors"
          >
            <Icon />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
