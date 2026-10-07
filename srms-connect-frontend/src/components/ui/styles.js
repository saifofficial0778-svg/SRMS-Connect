// Class recipes shared by the design-system components (and by the few places that need the
// same look on a <Link> or a native element). Kept apart from the components for fast refresh.

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none";

export const BUTTON_VARIANTS = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-600 active:bg-brand-700",
  secondary: "border border-ink/15 bg-white text-ink/85 shadow-sm hover:bg-ink/[0.04] hover:border-ink/25",
  ghost: "text-ink/70 hover:bg-ink/[0.06] hover:text-ink",
  accent: "border border-accent/50 bg-accent-50 text-accent-800 hover:bg-accent-100",
  danger: "border border-danger-200 bg-white text-danger hover:bg-danger-50",
  dangerSolid: "bg-danger text-white shadow-sm hover:bg-danger-700",
  link: "text-accent-700 hover:text-accent-800 underline-offset-4 hover:underline !px-0 !h-auto",
};

export const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export const buttonClass = ({ variant = "primary", size = "md", block = false, className = "" } = {}) =>
  [BUTTON_BASE, BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary, BUTTON_SIZES[size] || BUTTON_SIZES.md, block ? "w-full" : "", className].filter(Boolean).join(" ");

// the older pages name their button tones this way
export const BUTTON_TONES = {
  primary: BUTTON_VARIANTS.primary,
  secondary: BUTTON_VARIANTS.secondary,
  danger: BUTTON_VARIANTS.danger,
};

export const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-ink/35 transition-colors hover:border-ink/25 focus:border-brand/60 focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-ink/[0.03] disabled:text-ink/50";

// status colours: the label always carries the meaning, the colour only supports it
export const BADGE_TONES = {
  neutral: "bg-ink/[0.06] text-ink/70",
  muted: "bg-ink/[0.06] text-ink/60",
  brand: "bg-brand-50 text-brand",
  pending: "bg-accent-50 text-accent-800",
  accent: "bg-accent-50 text-accent-800",
  positive: "bg-success-50 text-success-700",
  negative: "bg-danger-50 text-danger-700",
};

export const segmentClass = (active) =>
  `rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${active ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"}`;
export const SEGMENT_TRACK = "inline-flex max-w-full overflow-x-auto scrollbar-none rounded-lg bg-ink/[0.06] p-1";
