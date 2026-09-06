import { useEffect } from "react";

export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[#1B2438]/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${
          wide ? "sm:max-w-lg" : "sm:max-w-md"
        } max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white border border-[#1B2438]/10 shadow-2xl`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1B2438]/10">
          <h2
            id="modal-title"
            className="text-lg text-[#1B2438]"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-[#1B2438]/60 hover:bg-[#1B2438]/5 hover:text-[#1B2438]"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
