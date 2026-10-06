import { statusMeta } from "../../utils/careerFormat";

const TONES = {
  pending: "bg-[#C98A2B]/10 text-[#9F6C1E]",
  positive: "bg-[#3F6B52]/10 text-[#2F5340]",
  negative: "bg-red-50 text-red-700",
  muted: "bg-[#1B2438]/8 text-[#1B2438]/60",
};

export default function StatusBadge({ status }) {
  const { label, tone } = statusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone] || TONES.muted}`}>
      {label}
    </span>
  );
}
