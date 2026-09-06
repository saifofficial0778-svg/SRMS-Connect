// Minimal inline icons so we don't introduce a new dependency
// (e.g. lucide-react) that may not already be in the project.

const base = "w-4 h-4 shrink-0";

export function LocationIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function BriefcaseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </svg>
  );
}

export function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function QuoteIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <path d="M7 8c-2 1-3 2.5-3 5v3h5v-6H6c0-1 .5-1.8 1.5-2.4L7 8Z" />
      <path d="M16 8c-2 1-3 2.5-3 5v3h5v-6h-3c0-1 .5-1.8 1.5-2.4L16 8Z" />
    </svg>
  );
}

export function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={base} {...props}>
      <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2 3.77-2 4 0 4.75 2.6 4.75 6.1V21h-4v-5.7c0-1.4-.03-3.1-1.9-3.1-1.9 0-2.2 1.5-2.2 3v5.8h-4V9Z" />
    </svg>
  );
}

export function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={base} {...props}>
      <path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.1-4.55-4.9 0-1.08.39-1.96 1.03-2.65-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.69 1.03 1.57 1.03 2.65 0 3.81-2.34 4.65-4.57 4.9.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function LinkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <path d="M9 15 15 9" />
      <path d="M10 6.5 11 5.5a4 4 0 1 1 5.7 5.7l-1.2 1.2" />
      <path d="M14 17.5 13 18.5a4 4 0 1 1-5.7-5.7l1.2-1.2" />
    </svg>
  );
}

export function ResumeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <path d="M8 3h5l4 4v14H8z" />
      <path d="M13 3v4h4" />
      <path d="M10 12h5M10 15.5h5M10 18h3" />
    </svg>
  );
}

export function CompassIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-1.5 4.5-4.5 1.5 1.5-4.5 4.5-1.5Z" />
    </svg>
  );
}
