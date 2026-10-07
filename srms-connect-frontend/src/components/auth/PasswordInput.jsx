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
        <label className="block text-sm font-medium text-ink/80 mb-1.5">
          {label}
        </label>
      )}
      <div
        className={`flex items-center rounded-lg border transition-colors ${
          error
            ? "border-danger"
            : "border-ink/15 focus-within:border-accent focus-within:ring-1 focus-within:ring-brand"
        }`}
      >
        <span className="pl-3.5 text-ink/35">
          <LockIcon />
        </span>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent px-3 py-3 text-sm text-ink outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="px-3.5 text-ink/40 hover:text-ink"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
