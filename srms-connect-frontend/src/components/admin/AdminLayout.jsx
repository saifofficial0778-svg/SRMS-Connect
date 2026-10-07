import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, LogOut, Megaphone, ShieldCheck, Users } from "lucide-react";
import { logoutUser } from "../../services/authService";
import srmsLogo from "../../assets/srms.png";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Members", icon: Users },
  { to: "/admin/spotlights", label: "Campus Spotlight", icon: Megaphone },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-50 text-brand" : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink"
  }`;

// The admin console: the same typography, colours and components as the member app, with a
// sidebar instead of the product navigation. On phones the sidebar becomes a strip of tabs.
export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="border-b border-ink/10 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img src={srmsLogo} alt="" className="h-9 w-auto object-contain" />
            <span className="leading-tight">
              <span className="block text-[15px] text-ink font-display">SRMS <span className="text-accent-700">Connect</span></span>
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                <ShieldCheck className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />Admin console
              </span>
            </span>
          </Link>
          <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/55 hover:bg-ink/[0.06] hover:text-ink lg:hidden" aria-label="Sign out">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto scrollbar-none px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="hidden border-t border-ink/8 p-3 lg:block">
          <Link to="/home" className={linkClass({ isActive: false })}>
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />Back to SRMS Connect
          </Link>
          <button onClick={handleLogout} className={`${linkClass({ isActive: false })} w-full`}>
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />Sign out
          </button>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
