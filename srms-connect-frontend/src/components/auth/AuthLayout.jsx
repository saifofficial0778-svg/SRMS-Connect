import { BadgeCheck } from "lucide-react";
import srmsLogo from "../../assets/srms.png";

// Sign-in, registration and password pages share this frame: the brand on the left (large
// screens), one focused form on the right. No decoration competes with the form.
export default function AuthLayout({ heading, tagline, features = [], cardTitle, cardSubtitle, children }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        {/* a quiet dot grid: texture, not decoration */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 w-px bg-accent/50" aria-hidden="true" />

        <div className="relative flex items-center gap-3.5">
          {/* a white tile keeps the red SRMS mark legible on the dark panel */}
          <span className="rounded-lg bg-white px-3 py-2 shadow-raised"><img src={srmsLogo} alt="" className="h-11 w-auto object-contain" /></span>
          <span className="text-xl font-display">SRMS <span className="text-accent">Connect</span></span>
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
            <BadgeCheck className="h-3.5 w-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
            Verified alumni network
          </p>
          <h2 className="text-[32px] leading-[1.15] font-display">{heading}</h2>
          {tagline && <p className="mt-4 text-[15px] leading-relaxed text-white/70">{tagline}</p>}

          {features.length > 0 && (
            <ul className="mt-9 space-y-4">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-accent">{f.icon}</span>
                  <span className="text-sm text-white/85">{f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="relative text-xs text-white/45">&copy; {new Date().getFullYear()} SRMS Connect</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[26rem] animate-rise">
          <div className="mb-8 flex flex-col items-center gap-2.5 lg:hidden">
            <img src={srmsLogo} alt="" className="h-14 w-auto object-contain" />
            <span className="text-lg text-ink font-display">SRMS <span className="text-accent-700">Connect</span></span>
          </div>

          <div className="card p-6 shadow-raised sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl text-ink font-display">{cardTitle}</h1>
              {cardSubtitle && <p className="mt-1.5 text-sm text-ink/60">{cardSubtitle}</p>}
            </div>
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-ink/45">Only members whose enrollment is in the college records can join.</p>
        </div>
      </main>
    </div>
  );
}
