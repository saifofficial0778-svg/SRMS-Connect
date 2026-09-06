export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-[toastIn_0.2s_ease-out] ${
            toast.type === "error"
              ? "bg-[#FBEEEA] border-[#E3B3A4] text-[#8A3521]"
              : "bg-[#EEF3EF] border-[#B9CFC0] text-[#25412F]"
          }`}
        >
          <span className="mt-0.5 text-base leading-none">
            {toast.type === "error" ? "!" : "\u2713"}
          </span>
          <p className="text-sm leading-snug">{toast.message}</p>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            Close
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
