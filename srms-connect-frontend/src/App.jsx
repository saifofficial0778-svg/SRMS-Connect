import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/auth/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Profile from "./pages/profile/Profile";
import Messaging from "./pages/messaging/Messaging"
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/home/Home";
import ComingSoon from "./pages/shared/ComingSoon";
import Network from "./pages/network/Network";
import PublicProfile from "./pages/profile/PublicProfile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<PublicProfile />} />
          <Route path="/network" element={<Network />} />
          <Route path="/chat" element={<Messaging />} />
          <Route path="/jobs" element={<ComingSoon title="Jobs" />} />
          <Route path="/mentorship" element={<ComingSoon title="Mentorship" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;