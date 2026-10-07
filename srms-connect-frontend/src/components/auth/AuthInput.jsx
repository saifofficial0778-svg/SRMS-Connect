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
        {icon && <span className="pl-3.5 text-ink/35">{icon}</span>}
        <input
          type={type}
          {...inputProps}
          className="w-full bg-transparent px-3 py-3 text-sm text-ink outline-none disabled:text-ink/50"
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
