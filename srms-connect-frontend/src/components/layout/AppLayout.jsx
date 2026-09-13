import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
