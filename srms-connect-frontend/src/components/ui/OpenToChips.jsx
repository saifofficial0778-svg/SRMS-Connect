import { openToLabel } from "../../utils/jobFormat";

// "Open to: Mentorship, Referrals" - read-only chips shown on public profiles and directory cards
export default function OpenToChips({ intents = [], className = "" }) {
  if (!intents.length) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Open to">
      <li className="text-xs font-medium text-[#1B2438]/50">Open to</li>
      {intents.map((intent) => (
        <li
          key={intent}
          className="rounded-full border border-[#C98A2B]/40 bg-[#C98A2B]/[0.08] px-2.5 py-0.5 text-xs font-medium text-[#9F6C1E]"
        >
          {openToLabel(intent)}
        </li>
      ))}
    </ul>
  );
}
