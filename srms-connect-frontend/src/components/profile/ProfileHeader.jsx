import { useState } from "react";
import Avatar from "./Avatar";
import ChangePhotoModal from "./ChangePhotoModal";
import PhotoMenu from "./PhotoMenu";
import ConfirmDialog from "../ui/ConfirmDialog";
import { BuildingIcon, LocationIcon } from "./icons";

export default function ProfileHeader({
  profile,
  onEditClick,
  onPhotoUpload,
  onPhotoRemove,
  showToast,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const {
    full_name,
    profile_photo,
    designation,
    company,
    location,
    bio,
  } = profile;

  const handlePhotoSubmit = async (file) => {
    await onPhotoUpload(file);
    setChangeModalOpen(false);
  };

  const handleConfirmRemove = async () => {
    setRemoving(true);
    try {
      await onPhotoRemove();
      setConfirmRemoveOpen(false);
    } catch (err) {
      showToast?.(
        err?.response?.data?.message || "Couldn't remove photo.",
        "error"
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section
      id="profile-header"
      className="relative overflow-hidden rounded-2xl border border-[#1B2438]/10 bg-white scroll-mt-6"
    >
      {/* record-card top band */}
      <div className="h-24 sm:h-28 bg-[#1B2438] relative overflow-hidden">
        {/* guilloché rosette — the engraved circular pattern found on
            transcripts, diplomas and certificates, echoing this section's
            "record card" identity */}
        <svg
          className="absolute -right-8 -top-10 sm:-top-16 h-44 w-44 sm:h-56 sm:w-56 opacity-[0.14] pointer-events-none"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={18 + i * 10}
              stroke="#C98A2B"
              strokeWidth="1"
              fill="none"
            />
          ))}
        </svg>

        {/* ledger rule — the ruled line of a record book page */}
        <div className="absolute inset-x-5 sm:inset-x-8 top-4 h-px bg-[#C98A2B]/25" />

        {/* scalloped ticket-stub edge where the band meets the card below,
            instead of a hard straight cut */}
        <div
          className="absolute inset-x-0 bottom-0 h-3 bg-white"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at 8px 0, transparent 7px, black 7.5px)",
            maskImage:
              "radial-gradient(circle at 8px 0, transparent 7px, black 7.5px)",
            WebkitMaskSize: "16px 16px",
            maskSize: "16px 16px",
            WebkitMaskRepeat: "repeat-x",
            maskRepeat: "repeat-x",
          }}
        />
      </div>

      <div className="px-5 sm:px-8 pb-6 sm:pb-8 pt-0">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* negative margin lives on this flex ITEM, not the row itself —
              margins never collapse on flex items, so this can't get
              swallowed into the parent and hide the row below it */}
          <div className="-mt-12 sm:-mt-14 shrink-0 relative">
            <Avatar
              photoUrl={profile_photo}
              fullName={full_name}
              size={112}
              onEditClick={() => setMenuOpen((v) => !v)}
            />
            {menuOpen && (
              <PhotoMenu
                hasPhoto={Boolean(profile_photo)}
                onChangeClick={() => {
                  setMenuOpen(false);
                  setChangeModalOpen(true);
                }}
                onRemoveClick={() => {
                  setMenuOpen(false);
                  setConfirmRemoveOpen(true);
                }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>

          <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-1">
            <h1
              className="text-2xl sm:text-3xl text-[#1B2438] truncate"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              {full_name || "Unnamed Student"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#1B2438]/70">
              {(designation || company) && (
                <span className="flex items-center gap-1.5">
                  <BuildingIcon />
                  {[designation, company].filter(Boolean).join(" at ")}
                </span>
              )}
              {location && (
                <span className="flex items-center gap-1.5">
                  <LocationIcon />
                  {location}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onEditClick}
            className="w-full sm:w-auto shrink-0 rounded-lg bg-[#C98A2B] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#B37A22] active:bg-[#9F6C1E] transition-colors"
          >
            Edit profile
          </button>
        </div>

        {bio && (
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[#1B2438]/80 border-l-2 border-[#C98A2B]/40 pl-4">
            {bio}
          </p>
        )}
      </div>

      {changeModalOpen && (
        <ChangePhotoModal
          currentPhoto={profile_photo}
          fullName={full_name}
          onClose={() => setChangeModalOpen(false)}
          onSubmit={handlePhotoSubmit}
        />
      )}

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Remove profile photo?"
        description="Your current photo will be deleted. You can upload a new one anytime."
        confirmLabel="Remove"
        busy={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemoveOpen(false)}
      />
    </section>
  );
}