import { openToLabel } from "../../utils/jobFormat";

// "Open to: Mentorship, Referrals" - read-only chips shown on public profiles and directory cards
export default function OpenToChips({ intents = [], className = "" }) {
  if (!intents.length) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Open to">
      <li className="text-xs font-medium text-ink/50">Open to</li>
      {intents.map((intent) => (
        <li
          key={intent}
          className="rounded-full border border-accent/40 bg-accent/[0.08] px-2.5 py-0.5 text-xs font-medium text-accent-700"
        >
          {openToLabel(intent)}
        </li>
      ))}
    </ul>
  );
}
