import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { forgotPassword } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthInput from "../../components/auth/AuthInput";
import AuthButton from "../../components/auth/AuthButton";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { IdCardIcon, KeyIcon, ShieldIcon } from "../../components/auth/icons";

const FEATURES = [
  { icon: <KeyIcon />, text: "Secure, token-based reset" },
  { icon: <ShieldIcon />, text: "Your account stays protected" },
];

export default function ForgotPassword() {
  const [enrollment, setEnrollment] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!enrollment.trim()) {
      setFieldError("Enter your enrollment number first.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      const data = await forgotPassword({ enrollment: enrollment.trim() });
      showToast("Reset token generated. Taking you to the next step...");
      // brief pause so the success message is actually visible before navigating
      setTimeout(() => {
        navigate("/reset-password", { state: { resetToken: data.data } });
      }, 700);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "We couldn't find that enrollment number. Please check and try again.";
      setFieldError(message);
      showToast(message, "error");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Forgot your password?"
      tagline="No worries — enter your enrollment number and we'll get you a reset token in seconds."
      features={FEATURES}
      cardTitle="Forgot password?"
      cardSubtitle="Enter your enrollment number to reset your password."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthInput
          label="Enrollment Number"
          icon={<IdCardIcon />}
          placeholder="Enter enrollment number"
          value={enrollment}
          onChange={(e) => setEnrollment(e.target.value)}
          autoComplete="username"
          error={fieldError}
        />

        <AuthButton type="submit" loading={loading} loadingText="Sending...">
          Send Reset Link
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
