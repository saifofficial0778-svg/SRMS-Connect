export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#1B2438]/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl bg-white border border-[#1B2438]/10 shadow-2xl p-6"
      >
        <h3 className="text-base font-semibold text-[#1B2438]">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-[#1B2438]/70">{description}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm text-[#1B2438]/70 hover:bg-[#1B2438]/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#B3432B] hover:bg-[#9A3823] disabled:opacity-60"
          >
            {busy ? "Removing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
