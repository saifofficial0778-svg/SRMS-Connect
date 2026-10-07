import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";

// Asks before anything destructive. Cancel is the safe default; Escape and the backdrop cancel.
export default function ConfirmDialog({ open, title, description, confirmLabel = "Delete", cancelLabel = "Cancel", busy = false, tone = "danger", onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && onCancel?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/45 animate-fade" onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-sm rounded-xl border border-ink/10 bg-white p-6 shadow-overlay animate-rise">
        <div className="flex gap-3.5">
          {tone === "danger" && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h3 id="confirm-title" className="text-base font-semibold text-ink">{title}</h3>
            {description && <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{description}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy} autoFocus>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "dangerSolid" : "primary"} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
