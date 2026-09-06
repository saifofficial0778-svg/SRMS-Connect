import { useEffect, useRef } from "react";

function ChangeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 13a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * Small floating action menu anchored under the avatar.
 * Shown when the user clicks the profile photo.
 * "Remove photo" only renders when a photo actually exists.
 */
export default function PhotoMenu({ hasPhoto, onChangeClick, onRemoveClick, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 w-44 rounded-xl border border-[#1B2438]/10 bg-white shadow-xl overflow-hidden"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onChangeClick}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1B2438] hover:bg-[#1B2438]/5 text-left"
      >
        <ChangeIcon />
        Change photo
      </button>
      {hasPhoto && (
        <button
          type="button"
          role="menuitem"
          onClick={onRemoveClick}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#B3432B] hover:bg-[#B3432B]/5 text-left border-t border-[#1B2438]/5"
        >
          <TrashIcon />
          Remove photo
        </button>
      )}
    </div>
  );
}