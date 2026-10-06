import { useState } from "react";
import { useLocation, useNavigate, Link, Navigate } from "react-router-dom";
import { resetPassword } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import PasswordInput from "../../components/auth/PasswordInput";
import PasswordStrengthMeter from "../../components/auth/PasswordStrengthMeter";
import AuthButton from "../../components/auth/AuthButton";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { ShieldIcon, CheckIcon } from "../../components/auth/icons";

const FEATURES = [
  { icon: <ShieldIcon />, text: "Identity verified through OTP" },
  { icon: <CheckIcon />, text: "Passwords are stored securely and never shared" },
];

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const resetToken = location.state?.resetToken || "";

  // no verified OTP -> send them back to start the flow
  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!newPassword) {
      setError("Enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await resetPassword({ resetToken, newPassword });
      showToast("Password reset. Redirecting to login...");
      // brief pause so the success message is actually visible before navigating
      setTimeout(() => navigate("/login"), 700);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Something went wrong. Please try again.";
      setError(message);
      showToast(message, "error");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Set a new password."
      tagline="Choose a strong password of at least 8 characters to keep your SRMS Connect account protected."
      features={FEATURES}
      cardTitle="Reset password"
      cardSubtitle="OTP verified. Enter your new password."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            error={error}
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>

        <PasswordInput
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />

        <AuthButton type="submit" loading={loading} loadingText="Resetting...">
          Reset Password
        </AuthButton>
      </form>

      <p className="text-center text-sm text-[#1B2438]/60 mt-6">
        Remember your password?{" "}
        <Link to="/login" className="text-[#C98A2B] hover:text-[#B37A22] font-medium">
          Back to Login
        </Link>
      </p>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AuthLayout>
  );
}
