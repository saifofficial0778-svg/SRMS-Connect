import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BarChart3, Briefcase, Compass, Home, LifeBuoy, MessageSquare, MoreHorizontal, Search, Users, X } from "lucide-react";
import { getProfile } from "../../services/profileService";
import useNotifications from "../../hooks/useNotifications";
import srmsLogo from "../../assets/srms.png";
import SearchBar from "./SearchBar";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "../notifications/NotificationBell";
import { MESSAGES_NAV, MOBILE_MORE_KEYS, MOBILE_NAV_KEYS, PRIMARY_NAV, isNavActive, navItem } from "../../utils/navigation";
import { formatBadgeCount } from "../../utils/notificationFormat";

const ICONS = { home: Home, network: Users, jobs: Briefcase, mentorship: Compass, career: LifeBuoy, insights: BarChart3, messages: MessageSquare };

// unread chat messages, read from the notifications already loaded for the bell
function useUnreadMessages() {
  const { items } = useNotifications();
  return items.filter((n) => n.type === "NEW_MESSAGE" && !n.is_read).length;
}

// Desktop: icon above label, with a bar under the section you are in.
function DesktopNavItem({ item, pathname }) {
  const Icon = ICONS[item.key];
  const active = isNavActive(item, pathname);
  return (
    <NavLink
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-16 min-w-[4.25rem] flex-col items-center justify-center gap-1 px-2 text-[11px] font-medium transition-colors ${
        active ? "text-brand" : "text-ink/55 hover:text-ink"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.1 : 1.8} aria-hidden="true" />
      {item.label}
      <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${active ? "bg-brand" : "bg-transparent group-hover:bg-ink/15"}`} aria-hidden="true" />
    </NavLink>
  );
}

function MobileTab({ item, pathname, badge, onClick }) {
  const Icon = ICONS[item.key];
  const active = isNavActive(item, pathname);
  return (
    <NavLink to={item.to} onClick={onClick} aria-current={active ? "page" : undefined} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${active ? "text-brand" : "text-ink/55"}`}>
      <span className="relative">
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.1 : 1.8} aria-hidden="true" />
        {badge ? <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white ring-2 ring-white">{badge}</span> : null}
      </span>
      {item.label}
    </NavLink>
  );
}

export default function Navbar() {
  // Fetched once per session - the shell stays mounted across page switches.
  const [user, setUser] = useState({ full_name: "", profile_photo: "", role: localStorage.getItem("role") || "" });
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const unreadMessages = formatBadgeCount(useUnreadMessages());

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((res) => {
        const data = res?.data || {};
        if (!cancelled) setUser({ full_name: data.full_name || "", profile_photo: data.profile_photo || "", role: data.role || localStorage.getItem("role") || "" });
      })
      .catch(() => {}); // the avatar just falls back to initials
    return () => {
      cancelled = true;
    };
  }, []);

  // the phone sheets close when you arrive somewhere
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMoreOpen(false);
    setSearchOpen(false);
  }

  const messagesActive = isNavActive(MESSAGES_NAV, pathname);
  const moreActive = MOBILE_MORE_KEYS.some((key) => isNavActive(navItem(key), pathname));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/home" className="flex shrink-0 items-center gap-2.5" aria-label="SRMS Connect home">
            <img src={srmsLogo} alt="" className="h-9 w-auto object-contain" />
            <span className="hidden text-[15px] leading-none text-ink font-display xl:block">
              SRMS <span className="text-accent-700">Connect</span>
            </span>
          </Link>

          <SearchBar className="hidden w-full max-w-[13rem] md:block lg:max-w-[17rem] xl:max-w-xs" />

          <nav aria-label="Primary" className="ml-auto hidden items-stretch md:flex">
            {PRIMARY_NAV.map((item) => <DesktopNavItem key={item.key} item={item} pathname={pathname} />)}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:ml-2 md:border-l md:border-ink/10 md:pl-3">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/65 transition-colors hover:bg-ink/[0.06] hover:text-ink md:hidden"
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="h-5 w-5" strokeWidth={1.9} /> : <Search className="h-5 w-5" strokeWidth={1.9} />}
            </button>

            <Link
              to={MESSAGES_NAV.to}
              aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}
              title="Messages"
              className={`relative hidden h-9 w-9 items-center justify-center rounded-lg transition-colors md:flex ${messagesActive ? "bg-brand-50 text-brand" : "text-ink/65 hover:bg-ink/[0.06] hover:text-ink"}`}
            >
              <MessageSquare className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              {unreadMessages && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">{unreadMessages}</span>}
            </Link>

            <NotificationBell />
            <ProfileMenu user={user} />
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-ink/10 bg-white px-4 py-3 md:hidden animate-fade">
            <SearchBar autoFocus onClose={() => setSearchOpen(false)} />
          </div>
        )}
      </header>

      {/* phones: a bottom bar within thumb reach instead of a shrunken desktop menu */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV_KEYS.map((key) => (
          <MobileTab key={key} item={navItem(key)} pathname={pathname} badge={key === "messages" ? unreadMessages : null} />
        ))}
        <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${moreActive || moreOpen ? "text-brand" : "text-ink/55"}`}>
          <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden="true" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-ink-900/40 animate-fade" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-label="More" className="absolute inset-x-0 bottom-16 rounded-t-xl border-t border-ink/10 bg-white p-3 shadow-overlay animate-rise">
            <ul className="grid grid-cols-3 gap-2">
              {MOBILE_MORE_KEYS.map((key) => {
                const item = navItem(key);
                const Icon = ICONS[key];
                const active = isNavActive(item, pathname);
                return (
                  <li key={key}>
                    <NavLink to={item.to} className={`flex flex-col items-center gap-1.5 rounded-lg px-2 py-4 text-xs font-medium ${active ? "bg-brand-50 text-brand" : "text-ink/70 hover:bg-ink/[0.05]"}`}>
                      <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
