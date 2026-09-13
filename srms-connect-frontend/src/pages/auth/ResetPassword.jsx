import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { resetPassword } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthInput from "../../components/auth/AuthInput";
import PasswordInput from "../../components/auth/PasswordInput";
import PasswordStrengthMeter from "../../components/auth/PasswordStrengthMeter";
import AuthButton from "../../components/auth/AuthButton";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { KeyIcon, ShieldIcon, CheckIcon } from "../../components/auth/icons";

const FEATURES = [
  { icon: <ShieldIcon />, text: "Your token is verified server-side" },
  { icon: <CheckIcon />, text: "Takes less than a minute" },
];

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const resetToken = location.state?.resetToken || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!newPassword) {
      setError("Enter a new password.");
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
      heading="Create a new password."
      tagline="Choose something strong and memorable — you'll be back to browsing SRMS Connect in a moment."
      features={FEATURES}
      cardTitle="Reset password"
      cardSubtitle="Enter your reset token and new password."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthInput
          label="Reset Token"
          icon={<KeyIcon />}
          value={resetToken}
          readOnly
          disabled
        />

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
