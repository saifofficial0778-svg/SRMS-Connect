export default function AuthButton({ loading, loadingText, children, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-600 active:bg-accent-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {loading ? loadingText : children}
    </button>
  );
}
