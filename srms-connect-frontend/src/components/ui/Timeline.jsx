// What happened, oldest first, as a vertical line of steps. The newest step is emphasised so the
// current state is obvious at a glance.
//   items = [{ label, time, note? }]
export default function Timeline({ items = [], title = "History" }) {
  if (!items.length) return null;
  const last = items.length - 1;
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base text-ink font-display">{title}</h2>
      <ol className="mt-4">
        {items.map((item, i) => (
          <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i !== last && <span className="absolute left-[7px] top-4 h-full w-px bg-ink/12" aria-hidden="true" />}
            <span className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${i === last ? "border-brand bg-brand ring-4 ring-brand-50" : "border-ink/25 bg-white"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-snug ${i === last ? "font-semibold text-ink" : "text-ink/75"}`}>{item.label}</p>
              {item.note && <p className="mt-0.5 text-[13px] text-ink/60">{item.note}</p>}
              <p className="mt-0.5 text-xs text-ink/45">{item.time}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
