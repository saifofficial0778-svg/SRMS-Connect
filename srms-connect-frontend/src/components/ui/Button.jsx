import { Link } from "react-router-dom";
import { buttonClass } from "./styles";

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// The one button. `to` renders a router link with the same look; `loading` keeps the width and
// blocks double submits.
export default function Button({ variant = "primary", size = "md", block = false, loading = false, icon: Icon, to, className = "", children, disabled, type = "button", ...rest }) {
  const classes = buttonClass({ variant, size, block, className });
  const content = (
    <>
      {loading ? <Spinner /> : Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> : null}
      {children}
    </>
  );
  if (to) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  return <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{content}</button>;
}

// square, icon-only; always needs a label for screen readers
export function IconButton({ icon: Icon, label, size = "md", variant = "ghost", className = "", badge, ...rest }) {
  const box = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <button type="button" aria-label={label} title={label} className={`relative ${buttonClass({ variant, className: `${box} !px-0 ${className}` })}`} {...rest}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
      {badge ? (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">{badge}</span>
      ) : null}
    </button>
  );
}
