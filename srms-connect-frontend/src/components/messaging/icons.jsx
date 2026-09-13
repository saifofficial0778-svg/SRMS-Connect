const base = "w-[18px] h-[18px] shrink-0";

// merges the base size classes with any incoming className instead of
// letting an incoming className silently wipe out sizing entirely
function cx(extra) {
  return `${base} ${extra || ""}`.trim();
}

export function SearchIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cx(className)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function SendIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cx(className)} {...props}>
      <path d="M4 12 20 4l-6 16-3-7-7-1Z" />
    </svg>
  );
}

export function BackIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cx(className)} {...props}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function ClockIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cx(className)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function CheckIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cx(className)} {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}

// NEW: double check for "seen" status
export function DoubleCheckIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cx(className)} {...props}>
      <path d="M2 12.5 6.5 17 13 8.5" />
      <path d="M9 12.5 13.5 17 21 7" />
    </svg>
  );
}

export function AlertIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cx(className)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

export function ChevronDownIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cx(className)} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
