import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";

export default function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-[#1B2438]/80 mb-1.5">
          {label}
        </label>
      )}
      <div
        className={`flex items-center rounded-lg border transition-colors ${
          error
            ? "border-[#B3432B]"
            : "border-[#1B2438]/15 focus-within:border-[#C98A2B] focus-within:ring-1 focus-within:ring-[#C98A2B]"
        }`}
      >
        <span className="pl-3.5 text-[#1B2438]/35">
          <LockIcon />
        </span>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent px-3 py-3 text-sm text-[#1B2438] outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="px-3.5 text-[#1B2438]/40 hover:text-[#1B2438]"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-[#B3432B]">{error}</p>}
    </div>
  );
}
