import { useState } from "react";

// calm, on-palette backgrounds for initials; the same name always gets the same one
const TINTS = [
  "bg-brand-100 text-brand",
  "bg-accent-100 text-accent-800",
  "bg-success-50 text-success-700",
  "bg-ink/10 text-ink/80",
  "bg-danger-50 text-danger-700",
];

function getInitials(fullName) {
  if (!fullName || !fullName.trim()) return "SR";
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function tintFor(fullName) {
  const text = fullName || "S";
  let sum = 0;
  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
  return TINTS[sum % TINTS.length];
}

// A person's photo, or their initials when there is none (or the stored link is broken).
//   online       small presence dot (used in Messaging)
//   onEditClick  makes the avatar a "change photo" button (own profile only)
export default function Avatar({ photoUrl, fullName, size = 128, onEditClick, online }) {
  const [broken, setBroken] = useState(null);
  const dimension = { width: size, height: size };
  const showPhoto = photoUrl && broken !== photoUrl;

  const face = showPhoto ? (
    <img
      src={photoUrl}
      alt={fullName || "Profile photo"}
      style={dimension}
      loading="lazy"
      className="rounded-full object-cover ring-1 ring-ink/10"
      onError={() => setBroken(photoUrl)}
    />
  ) : (
    <div style={dimension} className={`flex items-center justify-center rounded-full ring-1 ring-ink/5 ${tintFor(fullName)}`} aria-label={fullName || undefined} role={fullName ? "img" : undefined}>
      <span className="select-none font-semibold" style={{ fontSize: Math.max(10, size * 0.36), letterSpacing: "-0.01em" }}>
        {getInitials(fullName)}
      </span>
    </div>
  );

  const onlineDot = online && (
    <span
      className="absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-white"
      style={{ width: Math.max(8, size * 0.24), height: Math.max(8, size * 0.24) }}
      aria-label="Online"
    />
  );

  if (!onEditClick) {
    return (
      <div style={dimension} className="relative shrink-0">
        {face}
        {onlineDot}
      </div>
    );
  }

  return (
    <button type="button" onClick={onEditClick} style={dimension} className="group relative block shrink-0 rounded-full" aria-label="Change profile photo">
      {face}
      {onlineDot}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/0 transition-colors group-hover:bg-ink/45 group-focus-visible:bg-ink/45">
        <span className="text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Change</span>
      </span>
    </button>
  );
}
