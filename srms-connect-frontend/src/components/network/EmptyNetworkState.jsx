export default function EmptyNetworkState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-14 w-14 rounded-full bg-[#1B2438]/5 flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6 text-[#1B2438]/40">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17.5" cy="9.5" r="2.3" />
          <path d="M15.5 14c2.8.3 5 2.5 5.5 6" />
        </svg>
      </div>
      <p className="text-[#1B2438] font-medium">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-[#1B2438]/55 max-w-xs">{subtitle}</p>}
    </div>
  );
}