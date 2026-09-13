export default function Avatar({ src, name = "", size = "h-14 w-14" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${size} rounded-full object-cover ring-1 ring-[#1B2438]/10 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-[#1B2438]/8 text-[#1B2438] flex items-center justify-center font-semibold shrink-0`}
    >
      {initials || "?"}
    </div>
  );
}