const PALETTE = ["#C98A2B", "#3F6B52", "#1B2438", "#8A3521", "#3D5A80"];

function getInitials(fullName) {
  if (!fullName || !fullName.trim()) return "SR";
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function getColor(fullName) {
  const seed = (fullName || "S").charCodeAt(0);
  return PALETTE[seed % PALETTE.length];
}

export default function Avatar({ photoUrl, fullName, size = 128, onEditClick, online }) {
  const dimension = { width: size, height: size };

  const image = photoUrl ? (
    <img
      src={photoUrl}
      alt={fullName || "Profile photo"}
      style={dimension}
      className="rounded-full object-cover ring-4 ring-white shadow-[0_0_0_3px_#C98A2B]"
      onError={(e) => {
        // fall back gracefully if the stored URL is broken
        e.currentTarget.style.display = "none";
      }}
    />
  ) : (
    <div
      style={{ ...dimension, backgroundColor: getColor(fullName) }}
      className="rounded-full flex items-center justify-center ring-4 ring-white shadow-[0_0_0_3px_#C98A2B]"
    >
      <span
        className="text-white select-none"
        style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: size * 0.36,
        }}
      >
        {getInitials(fullName)}
      </span>
    </div>
  );

  // NEW: small green dot for online status (used in Messaging). Optional —
  // omit the `online` prop anywhere else and nothing changes.
  const onlineDot = online && (
    <span
      className="absolute bottom-0 right-0 rounded-full bg-[#3F6B52] ring-2 ring-white"
      style={{ width: size * 0.26, height: size * 0.26 }}
    />
  );

  // No onEditClick passed (e.g. used inside ChangePhotoModal's preview,
  // or in Messaging/Feed where photo isn't editable) — just show the
  // plain photo/initials, optionally with the online dot, not clickable.
  if (!onEditClick) {
    return (
      <div
        style={dimension}
        className="relative transition-transform duration-200 hover:scale-[1.03]"
      >
        {image}
        {onlineDot}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEditClick}
      style={dimension}
      className="group relative block rounded-full transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C98A2B] focus-visible:ring-offset-2"
      aria-label="Change profile photo"
    >
      {image}
      {onlineDot}
      <span className="absolute inset-0 rounded-full bg-[#1B2438]/0 group-hover:bg-[#1B2438]/40 transition-colors flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
          Change
        </span>
      </span>
    </button>
  );
}
