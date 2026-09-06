import { useEffect, useState } from "react";
import {
  getProfile,
  updateProfile,
  updateProfilePhoto,
  deleteProfilePhoto,
} from "../../services/profileService";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import ProfileHeader from "../../components/profile/ProfileHeader";
import BasicInfoCard from "../../components/profile/BasicInfoCard";
import SocialLinks from "../../components/profile/SocialLinks";
import SkillsSection from "../../components/profile/SkillsSection";
import ProjectsSection from "../../components/profile/ProjectsSection";
import EditProfileModal from "../../components/profile/EditProfileModal";
import ProfileSkeleton from "../../components/profile/ProfileSkeleton";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { toasts, showToast, dismiss } = useToast();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getProfile();
        if (cancelled) return;
        const data = res?.data || {};
        setProfile(data);
        setSkills(data.skills || []);
        setProjects(data.projects || []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              "Couldn't load your profile. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleProfileUpdate = async (payload) => {
    await updateProfile(payload);
    // backend returns affectedRows, not the updated profile, so we
    // merge the submitted fields into local state ourselves.
    setProfile((prev) => ({ ...prev, ...payload }));
    setEditOpen(false);
    showToast("Profile updated.");
  };

  // Dedicated Cloudinary upload — sends the file via PATCH /profile/photo
  // (multipart), not the generic updateProfile endpoint.
  const handlePhotoUpload = async (file) => {
    const res = await updateProfilePhoto(file);
    const newUrl = res?.data?.profilePhoto;
    setProfile((prev) => ({ ...prev, profile_photo: newUrl }));
    showToast("Profile photo updated.");
  };

  // Deletes the image from Cloudinary and clears it on the profile.
  const handlePhotoRemove = async () => {
    await deleteProfilePhoto();
    setProfile((prev) => ({ ...prev, profile_photo: null }));
    showToast("Profile photo removed.");
  };

  if (loading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <p className="text-[#1B2438] font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-[#1B2438] text-white text-sm hover:bg-[#141B2C]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <p className="text-[#1B2438]/70">No profile found for this account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <ProfileHeader
          profile={profile}
          onEditClick={() => setEditOpen(true)}
          onPhotoUpload={handlePhotoUpload}
          onPhotoRemove={handlePhotoRemove}
          showToast={showToast}
        />

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-5 items-start">
          <div className="space-y-5">
            <SkillsSection
              skills={skills}
              setSkills={setSkills}
              showToast={showToast}
            />
            <ProjectsSection
              projects={projects}
              setProjects={setProjects}
              showToast={showToast}
            />
          </div>
          <div className="space-y-5">
            <BasicInfoCard profile={profile} />
            <SocialLinks profile={profile} />
          </div>
        </div>
      </div>

      {editOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSubmit={handleProfileUpdate}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}