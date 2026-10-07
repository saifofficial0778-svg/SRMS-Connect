export default function ComingSoon({ title }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
      <div className="text-center max-w-sm">
        <div
          className="mx-auto h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center text-accent-700 text-2xl font-display"
        >
          {title?.[0] || "S"}
        </div>
        <h1
          className="mt-5 text-2xl text-ink font-display"
        >
          {title}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          This is coming soon to SRMS Connect. Check back shortly.
        </p>
      </div>
    </div>
  );
}
