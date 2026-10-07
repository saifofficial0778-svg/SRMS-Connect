import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import NotificationsProvider from "../../context/NotificationsProvider";

export default function AppLayout() {
  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-canvas">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised">Skip to content</a>
        <Navbar />
        <main id="main" className="pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
    </NotificationsProvider>
  );
}
