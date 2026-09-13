import srmsLogo from "../../assets/srms.png";



export default function AuthLayout({
  heading,
  tagline,
  features = [],
  cardTitle,
  cardSubtitle,
  children,
}) {
  return (
    <div className="min-h-screen bg-[#F5F6F8] flex">
      {/* Left brand panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative bg-[#1B2438] text-white flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0 22px, #C98A2B 22px 23px)",
          }}
        />

        <div className="relative flex flex-col items-start gap-2">
          <img src={srmsLogo} alt="SRMS Connect" className="h-16 w-auto object-contain" />
          <span
            className="text-3xl tracking-tight"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            SRMS Connect
          </span>
        </div>

        <div className="relative max-w-sm">
          <h2
            className="text-3xl leading-tight"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            {heading}
          </h2>
          {tagline && (
            <p className="mt-3 text-white/70 text-[15px] leading-relaxed">
              {tagline}
            </p>
          )}

          {features.length > 0 && (
            <div className="mt-10 space-y-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-[#C98A2B]">
                    {f.icon}
                  </span>
                  <span className="text-sm text-white/85">{f.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="relative text-xs text-white/40">
          &copy; {new Date().getFullYear()} SRMS Connect
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md animate-[authFadeIn_0.35s_ease-out]">
          {/* mobile-only brand mark */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8">
            <img src={srmsLogo} alt="SRMS Connect" className="h-16 w-auto object-contain" />
            <span
              className="text-lg text-[#1B2438]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              SRMS Connect
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#1B2438]/10 p-7 sm:p-9 shadow-sm">
            <div className="mb-7">
              <h1
                className="text-2xl text-[#1B2438]"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              >
                {cardTitle}
              </h1>
              {cardSubtitle && (
                <p className="mt-1.5 text-sm text-[#1B2438]/60">
                  {cardSubtitle}
                </p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}