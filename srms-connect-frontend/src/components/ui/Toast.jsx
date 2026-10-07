import { CheckCircle2, AlertCircle, X } from "lucide-react";

// Short confirmations and errors, bottom-right (full width on phones). The icon and the wording
// carry the meaning; colour only supports it.
export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 sm:left-auto sm:w-[22rem] md:bottom-5 md:right-5">
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const Icon = isError ? AlertCircle : CheckCircle2;
        return (
          <div key={toast.id} role={isError ? "alert" : "status"} className="flex items-start gap-3 rounded-lg border border-ink/10 bg-white px-4 py-3 shadow-raised animate-rise">
            <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isError ? "text-danger" : "text-success"}`} strokeWidth={2} aria-hidden="true" />
            <p className="flex-1 text-sm leading-snug text-ink/90">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink/40 transition-colors hover:bg-ink/[0.06] hover:text-ink" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
