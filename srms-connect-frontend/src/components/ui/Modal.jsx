import { useEffect } from "react";
import { X } from "lucide-react";

// Centered dialog on desktop, bottom sheet on phones. Escape and the backdrop close it.
//   wide    a roomier dialog for forms
//   footer  sticky action row (kept visible while the body scrolls)
export default function Modal({ title, description, onClose, children, wide = false, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/45 animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-ink/10 bg-white shadow-overlay animate-rise sm:rounded-xl ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/8 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-[17px] text-ink font-display">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink/55">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-ink/[0.06] hover:text-ink" aria-label="Close">
            <X className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink/8 bg-canvas/60 px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}
