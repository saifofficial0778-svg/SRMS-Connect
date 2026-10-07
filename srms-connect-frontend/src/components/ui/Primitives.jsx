import { NavLink } from "react-router-dom";
import { AlertTriangle, Inbox } from "lucide-react";
import Button from "./Button";
import { BADGE_TONES, SEGMENT_TRACK, inputClass, segmentClass } from "./styles";

// ---------- surfaces ----------

export function Card({ as: Tag = "section", padded = true, className = "", children, ...rest }) {
  return <Tag className={`card ${padded ? "p-5 sm:p-6" : ""} ${className}`} {...rest}>{children}</Tag>;
}

// title + optional description on the left, actions on the right
export function SectionHeader({ title, description, action, as: Tag = "h2", className = "" }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="min-w-0">
        <Tag className="text-base text-ink font-display">{title}</Tag>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink/55">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// the top of a page: one h1, one line of context, then tabs or actions
export function PageHeader({ title, subtitle, eyebrow, actions, children }) {
  return (
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-[28px] leading-tight text-ink font-display">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink/60">{subtitle}</p>}
      </div>
      {(actions || children) && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}{children}</div>}
    </header>
  );
}

// ---------- status ----------

export function Badge({ label, tone = "neutral", icon: Icon, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE_TONES[tone] || BADGE_TONES.neutral} ${className}`}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />}
      {label ?? children}
    </span>
  );
}

export function Chip({ children, tone = "neutral", className = "" }) {
  const tones = { neutral: "border-ink/12 bg-white text-ink/75", accent: "border-accent/40 bg-accent-50 text-accent-800", brand: "border-brand-100 bg-brand-50 text-brand" };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}>{children}</span>;
}

// ---------- navigation inside a page ----------

// tabs = [{ to, label, end?, count? }] for routes, or [{ value, label, count? }] with value/onChange
export function Tabs({ tabs, value, onChange, label, className = "" }) {
  const routed = tabs.some((t) => t.to);
  const count = (t) => (t.count ? <span className="ml-1.5 rounded-full bg-ink/10 px-1.5 text-[11px] tabular-nums">{t.count}</span> : null);
  if (routed) {
    return (
      <nav aria-label={label} className={`${SEGMENT_TRACK} ${className}`}>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => segmentClass(isActive)}>{t.label}{count(t)}</NavLink>
        ))}
      </nav>
    );
  }
  return (
    <div role="tablist" aria-label={label} className={`${SEGMENT_TRACK} ${className}`}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)} className={segmentClass(t.value === value)}>{t.label}{count(t)}</button>
      ))}
    </div>
  );
}

// ---------- forms ----------

export function Field({ label, error, hint, optional = false, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink/85">
        {label}
        {optional && <span className="text-xs font-normal text-ink/40">Optional</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink/50">{hint}</span>}
      {error && <span role="alert" className="mt-1.5 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const Input = ({ className = "", ...rest }) => <input className={`${inputClass} ${className}`} {...rest} />;
export const Textarea = ({ className = "", rows = 4, ...rest }) => <textarea rows={rows} className={`${inputClass} resize-y ${className}`} {...rest} />;
export const Select = ({ className = "", children, ...rest }) => <select className={`${inputClass} pr-8 ${className}`} {...rest}>{children}</select>;

// ---------- loading / empty / error ----------

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

// a card-shaped placeholder that keeps the layout from jumping while data loads
export function SkeletonCard({ lines = 3, avatar = false, className = "" }) {
  return (
    <div className={`card p-5 ${className}`} aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        {avatar && <Skeleton className="h-11 w-11 !rounded-full shrink-0" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-3/5" : "w-full"}`} />)}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action, compact = false, className = "" }) {
  return (
    <div className={`card flex flex-col items-center text-center ${compact ? "px-5 py-8" : "px-6 py-14"} ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.05] text-ink/45"><Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" /></span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm leading-relaxed text-ink/55">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load this", children, onRetry, compact = false, className = "" }) {
  return (
    <div role="alert" className={`card flex flex-col items-center text-center ${compact ? "px-5 py-8" : "px-6 py-14"} ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger"><AlertTriangle className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" /></span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <div className="mt-1 max-w-md text-sm text-ink/55">{children || "Check your connection and try again."}</div>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// ---------- numbers ----------

export function StatCard({ value, label, hint, icon: Icon, trend, className = "" }) {
  return (
    <div className={`card px-5 py-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink/60">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-ink/30" strokeWidth={1.8} aria-hidden="true" />}
      </div>
      <p className="mt-1.5 text-[28px] leading-none tabular-nums text-ink font-display">{value}</p>
      {trend && <p className={`mt-2 text-xs font-medium ${trend.tone === "up" ? "text-success-700" : trend.tone === "down" ? "text-danger-700" : "text-ink/50"}`}>{trend.text}</p>}
      {hint && <p className="mt-1.5 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

export function Pager({ page, totalPages, onChange, className = "" }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={`flex items-center justify-between pt-2 ${className}`}>
      <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>Previous</Button>
      <span className="text-[13px] tabular-nums text-ink/55">Page {page} of {totalPages}</span>
      <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Next</Button>
    </nav>
  );
}
