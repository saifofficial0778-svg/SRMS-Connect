import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../profile/Avatar";
import { UserIcon, SettingsIcon, LogoutIcon, ChevronDownIcon } from "./navIcons";

export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/login");
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C98A2B] focus-visible:ring-offset-2"
        aria-label="Account menu"
      >
        <span className="shrink-0 rounded-full overflow-hidden">
          <Avatar photoUrl={user?.profile_photo} fullName={user?.full_name} size={36} />
        </span>
        <ChevronDownIcon className="hidden sm:block text-[#1B2438]/40" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[#1B2438]/10 bg-white shadow-xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-[#1B2438]/10">
            <p className="text-sm font-medium text-[#1B2438] truncate">
              {user?.full_name || "SRMS Member"}
            </p>
          </div>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1B2438] hover:bg-[#1B2438]/5 text-left"
          >
            <UserIcon /> My Profile
          </button>

          {/* No /settings route exists yet — shown as a disabled preview
              rather than left out entirely, per the "Settings" item asked
              for. Wire this up once the route/page exists. */}
          <button
            role="menuitem"
            disabled
            className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-[#1B2438]/35 cursor-not-allowed text-left"
          >
            <span className="flex items-center gap-2.5">
              <SettingsIcon /> Settings
            </span>
            <span className="text-[10px] uppercase tracking-wide bg-[#1B2438]/5 px-1.5 py-0.5 rounded">
              Soon
            </span>
          </button>

          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#B3432B] hover:bg-[#B3432B]/5 text-left border-t border-[#1B2438]/5"
          >
            <LogoutIcon /> Logout
          </button>
        </div>
      )}
    </div>
  );
}