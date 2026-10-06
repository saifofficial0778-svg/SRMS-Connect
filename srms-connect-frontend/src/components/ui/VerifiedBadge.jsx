// Shown next to alumni who are verified: their enrollment matched the college's alumni
// records and an admin approved the account.
export default function VerifiedBadge({ compact = false, className = "" }) {
  const seal = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M12 2.2l2.4 1.7 2.9-.2 1.1 2.7 2.5 1.5-.7 2.8 1 2.7-2 2.1-.4 2.9-2.8.8-1.9 2.2-2.7-1.1-2.7 1.1-1.9-2.2-2.8-.8-.4-2.9-2-2.1 1-2.7-.7-2.8 2.5-1.5 1.1-2.7 2.9.2L12 2.2z"
        fill="#C98A2B"
      />
      <path d="M8.3 12.4l2.5 2.5 4.9-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (compact) {
    return (
      <span title="Verified Alumni" aria-label="Verified Alumni" className={`inline-flex items-center ${className}`}>
        {seal}
      </span>
    );
  }

  return (
    <span
      title="Verified Alumni: matched against college alumni records and approved by an admin"
      className={`inline-flex items-center gap-1 rounded-full bg-[#C98A2B]/10 px-2 py-0.5 text-[11px] font-semibold text-[#9F6C1E] whitespace-nowrap ${className}`}
    >
      {seal}
      Verified Alumni
    </span>
  );
}
