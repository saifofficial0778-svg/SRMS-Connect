export default function ComingSoon({ title }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
      <div className="text-center max-w-sm">
        <div
          className="mx-auto h-14 w-14 rounded-full bg-[#C98A2B]/10 flex items-center justify-center text-[#C98A2B] text-2xl"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {title?.[0] || "S"}
        </div>
        <h1
          className="mt-5 text-2xl text-[#1B2438]"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm text-[#1B2438]/60">
          This is coming soon to SRMS Connect. Check back shortly.
        </p>
      </div>
    </div>
  );
}
