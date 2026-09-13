export default function AuthInput({
  label,
  icon,
  error,
  type = "text",
  ...inputProps
}) {
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
        {icon && <span className="pl-3.5 text-[#1B2438]/35">{icon}</span>}
        <input
          type={type}
          {...inputProps}
          className="w-full bg-transparent px-3 py-3 text-sm text-[#1B2438] outline-none disabled:text-[#1B2438]/50"
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-[#B3432B]">{error}</p>}
    </div>
  );
}
