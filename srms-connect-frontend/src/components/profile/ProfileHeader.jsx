import { useState } from "react";
import Avatar from "./Avatar";
import ChangePhotoModal from "./ChangePhotoModal";
import PhotoMenu from "./PhotoMenu";
import ConfirmDialog from "../ui/ConfirmDialog";
import { BarChart3, Pencil } from "lucide-react";
import Button from "../ui/Button";
import ProfileHero from "./ProfileHero";
import { academicLine, headline, isVerifiedAlumni } from "../../utils/personFormat";

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

  const { full_name, profile_photo, location, bio } = profile;

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
    <div id="profile-header" className="scroll-mt-24">
      <ProfileHero
        name={full_name || "Unnamed member"}
        role={profile.role}
        verified={isVerifiedAlumni(profile)}
        work={headline(profile)}
        academic={academicLine(profile)}
        location={location}
        bio={bio}
        avatar={
          <div className="relative">
            <Avatar photoUrl={profile_photo} fullName={full_name} size={112} onEditClick={() => setMenuOpen((v) => !v)} />
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
        }
        actions={
          <>
            <Button variant="secondary" to="/analytics" icon={BarChart3}>Analytics</Button>
            <Button onClick={onEditClick} icon={Pencil}>Edit profile</Button>
          </>
        }
      />

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
    </div>
  );
}