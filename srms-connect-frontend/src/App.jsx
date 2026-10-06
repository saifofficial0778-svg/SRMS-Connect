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
import Network from "./pages/network/Network";
import PublicProfile from "./pages/profile/PublicProfile";
import AdminLayout from "./components/admin/AdminLayout";
import AdminRoute from "./components/admin/AdminRoute";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AlumniDirectory from "./pages/alumni/AlumniDirectory";
import JobsPage from "./pages/jobs/JobsPage";
import JobDetailPage from "./pages/jobs/JobDetailPage";
import JobFormPage from "./pages/jobs/JobFormPage";
import CareerDashboard from "./pages/career/CareerDashboard";
import CareerRequestPage from "./pages/career/CareerRequestPage";
import NewCareerRequestPage from "./pages/career/NewCareerRequestPage";
import IndustryPulsePage from "./pages/insights/IndustryPulsePage";
import SkillGapPage from "./pages/insights/SkillGapPage";
import MentorsPage from "./pages/mentorship/MentorsPage";
import MentorDetailPage from "./pages/mentorship/MentorDetailPage";
import MentorProfilePage from "./pages/mentorship/MentorProfilePage";
import MentorshipDashboard from "./pages/mentorship/MentorshipDashboard";
import MentorshipDetailPage from "./pages/mentorship/MentorshipDetailPage";
import IntrosPage from "./pages/mentorship/IntrosPage";
import NewIntroPage from "./pages/mentorship/NewIntroPage";
import IntroDetailPage from "./pages/mentorship/IntroDetailPage";

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
          <Route path="/alumni" element={<AlumniDirectory />} />
          <Route path="/chat" element={<Messaging />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<JobFormPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/jobs/:id/edit" element={<JobFormPage />} />
          <Route path="/career" element={<CareerDashboard />} />
          <Route path="/career/new" element={<NewCareerRequestPage />} />
          <Route path="/career/requests/:id" element={<CareerRequestPage />} />
          <Route path="/industry-pulse" element={<IndustryPulsePage />} />
          <Route path="/skill-gap" element={<SkillGapPage />} />
          <Route path="/mentorship" element={<MentorsPage />} />
          <Route path="/mentorship/mentors/:id" element={<MentorDetailPage />} />
          <Route path="/mentorship/profile" element={<MentorProfilePage />} />
          <Route path="/mentorship/dashboard" element={<MentorshipDashboard />} />
          <Route path="/mentorship/requests/:id" element={<MentorshipDetailPage />} />
          <Route path="/mentorship/intros" element={<IntrosPage />} />
          <Route path="/mentorship/intros/new" element={<NewIntroPage />} />
          <Route path="/mentorship/intros/:id" element={<IntroDetailPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="users" element={<AdminUsersPage />} />
          {/* future: <Route path="reports" element={<AdminReportsPage />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;