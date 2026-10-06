import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import NotificationsProvider from "../../context/NotificationsProvider";

export default function AppLayout() {
  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-[#F5F6F8]">
        <Navbar />
        <main>
          <Outlet />
        </main>
      </div>
    </NotificationsProvider>
  );
}
