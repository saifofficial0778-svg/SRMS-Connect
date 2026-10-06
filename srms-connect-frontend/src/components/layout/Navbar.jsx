import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getProfile } from "../../services/profileService";
import srmsLogo from "../../assets/srms.png";
import SearchBar from "./SearchBar";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "../notifications/NotificationBell";
import { HomeIcon, ChatIcon, BriefcaseIcon, CompassIcon, UsersIcon, GraduationIcon, HandshakeIcon, ChartIcon, MenuIcon, CloseIcon, SearchIcon } from "./navIcons";

const NAV_LINKS = [
  { to: "/home", label: "Feed", icon: HomeIcon },
  { to: "/network", label: "My Network", icon: UsersIcon },
  { to: "/alumni", label: "Alumni", icon: GraduationIcon },
  { to: "/chat", label: "Chat", icon: ChatIcon },
  { to: "/jobs", label: "Jobs", icon: BriefcaseIcon },
  { to: "/career", label: "Career help", icon: HandshakeIcon },
  // one entry for both insight pages (Industry Pulse and My Skill Gap link to each other)
  { to: "/industry-pulse", label: "Insights", icon: ChartIcon, alsoActiveOn: ["/skill-gap"] },
  { to: "/mentorship", label: "Mentorship", icon: CompassIcon },
];

function linkClasses({ isActive }) {
  return `flex items-center gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
    isActive
      ? "bg-[#C98A2B]/10 text-[#C98A2B]"
      : "text-[#1B2438]/65 hover:text-[#1B2438] hover:bg-[#1B2438]/5"
  }`;
}

export default function Navbar() {
  // Fetched once per session — Navbar stays mounted across page
  // switches (see AppLayout), so this never re-fires on navigation.
  const [user, setUser] = useState({ full_name: "", profile_photo: "" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getProfile();
        if (!cancelled) {
          const data = res?.data || {};
          setUser({
            full_name: data.full_name || "",
            profile_photo: data.profile_photo || "",
          });
        }
      } catch {
        // Navbar shouldn't block the page on a profile-fetch failure —
        // the avatar just falls back to initials/default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#1B2438]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-5">
        {/* Brand */}
        <NavLink to="/home" className="flex items-center shrink-0">
          <img
            src={srmsLogo}
            alt="SRMS Connect"
            className="h-9 sm:h-10 w-auto object-contain"
          />
        </NavLink>

        {/* Desktop search — sits right next to the logo */}
        <SearchBar className="hidden md:block w-full max-w-[14rem] lg:max-w-[18rem] xl:max-w-xs" />

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 ml-auto">
          {NAV_LINKS.map(({ to, label, icon: Icon, alsoActiveOn = [] }) => {
            const forcedActive = alsoActiveOn.includes(pathname);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => linkClasses({ isActive: isActive || forcedActive })}
                title={label}
                aria-label={label}
              >
                {({ isActive }) => (
                  <>
                    <Icon />
                    {/* With this many destinations the bar shows icons (with tooltips) and spells out
                        only the page you are on, so everything fits on one line next to the search. */}
                    {(isActive || forcedActive) && <span className="hidden lg:inline">{label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1.5 ml-auto md:ml-4">
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg text-[#1B2438]/70 hover:bg-[#1B2438]/5"
            aria-label={mobileSearchOpen ? "Close search" : "Open search"}
          >
            {mobileSearchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>

          <NotificationBell />

          <ProfileMenu user={user} />

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg text-[#1B2438]/70 hover:bg-[#1B2438]/5"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile search bar — full width, appears below the header */}
      {mobileSearchOpen && (
        <div className="md:hidden border-t border-[#1B2438]/10 px-4 py-3 bg-white">
          <SearchBar autoFocus onClose={() => setMobileSearchOpen(false)} />
        </div>
      )}

      {/* Mobile nav panel */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-[#1B2438]/10 px-4 py-3 flex flex-col gap-1 bg-white">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={linkClasses}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}