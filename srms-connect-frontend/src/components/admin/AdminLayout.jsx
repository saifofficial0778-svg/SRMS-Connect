import { Link, useNavigate, Outlet } from "react-router-dom";
import { logoutUser } from "../../services/authService";

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleSwitchToUserPanel = () => {
    navigate("/home");
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <header className="bg-[#1B2438] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl font-bold">SRMS Connect</span>
          <span className="text-xs bg-[#C98A2B] px-2 py-1 rounded-full font-medium">
            Admin Panel
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSwitchToUserPanel}
            className="text-sm border border-white/30 px-3 py-1.5 rounded-md hover:bg-white/10 transition"
          >
            Switch to User Panel
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-[#B3432B] hover:text-[#8f3522] font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-[#1B2438]/10 px-6">
        <div className="flex gap-6">
          <Link
            to="/admin/users"
            className="py-3 text-sm font-medium text-[#1B2438] border-b-2 border-[#C98A2B]"
          >
            User Management
          </Link>
          {/* future tabs: Alumni Verification, Reports, etc. */}
        </div>
      </nav>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}