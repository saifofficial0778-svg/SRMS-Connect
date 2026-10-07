import { useCallback, useEffect, useRef, useState } from "react";

const arrowClass =
  "flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 bg-white text-ink shadow-sm transition-colors hover:bg-ink/5 disabled:opacity-30 disabled:hover:bg-white";

// A row of cards that slides sideways: arrows, swipe / trackpad scroll and keyboard all work,
// and cards snap into place. The arrows disable themselves at either end.
export default function HorizontalSlider({ label, children, className = "" }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const frame = requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, children]);

  // move by roughly one screenful of cards
  const slide = (direction) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.85), behavior: "smooth" });
  };

  const scrollable = !(edges.start && edges.end);

  return (
    <div className={`relative ${className}`}>
      <ul
        ref={trackRef}
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
      >
        {children}
      </ul>

      {scrollable && (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => slide(-1)} disabled={edges.start} aria-label="Previous" className={arrowClass}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => slide(1)} disabled={edges.end} aria-label="Next" className={arrowClass}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
