import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ChevronDown, LogOut, ShieldCheck, UserRound, Users } from "lucide-react";
import { logoutUser } from "../../services/authService";
import Avatar from "../profile/Avatar";

const ROLE_LABEL = { STUDENT: "Student", ALUMNI: "Alumni", ADMIN: "Administrator" };
const itemClass = "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-ink/85 transition-colors hover:bg-ink/[0.05] hover:text-ink";

// Account menu: everything about "me" that is not a product area.
export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const links = [
    { to: "/profile", label: "View profile", icon: UserRound },
    { to: "/analytics", label: "My analytics", icon: BarChart3 },
    { to: "/network", label: "My network", icon: Users },
    // the server decides who is an admin; this only shows the door
    ...(user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin console", icon: ShieldCheck }] : []),
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="ml-1 flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-ink/[0.06]"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar photoUrl={user?.profile_photo} fullName={user?.full_name} size={34} />
        <ChevronDown className={`hidden h-4 w-4 text-ink/40 transition-transform sm:block ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-overlay animate-rise">
          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-ink/8 px-4 py-3.5 hover:bg-ink/[0.03]">
            <Avatar photoUrl={user?.profile_photo} fullName={user?.full_name} size={42} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{user?.full_name || "SRMS Member"}</span>
              <span className="block text-xs text-ink/55">{ROLE_LABEL[user?.role] || "Member"}</span>
            </span>
          </Link>

          <div className="p-1.5">
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <Icon className="h-4 w-4 text-ink/50" strokeWidth={1.9} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-ink/8 p-1.5">
            <button role="menuitem" onClick={handleLogout} className={`${itemClass} !text-danger hover:!bg-danger-50`}>
              <LogOut className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
