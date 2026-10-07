import ProfileAvatar from "../profile/Avatar";

// The network cards used their own avatar; it now delegates to the one shared Avatar.
export default function Avatar({ src, name = "", size = 48 }) {
  return <ProfileAvatar photoUrl={src} fullName={name} size={typeof size === "number" ? size : 48} />;
}
