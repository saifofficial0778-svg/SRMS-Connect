import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { forgotPassword, verifyForgotPasswordOtp } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthInput from "../../components/auth/AuthInput";
import AuthButton from "../../components/auth/AuthButton";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { IdCardIcon, KeyIcon, ShieldIcon } from "../../components/auth/icons";

const FEATURES = [
  { icon: <KeyIcon />, text: "One-time passcode sent to your registered email" },
  { icon: <ShieldIcon />, text: "Verified, encrypted and time-limited reset" },
];

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const [step, setStep] = useState("ENROLLMENT"); // "ENROLLMENT" | "OTP"
  const [enrollment, setEnrollment] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const sendOtp = async () => {
    const data = await forgotPassword({ enrollment: enrollment.trim() });
    showToast(data.message);
    setResendTimer(RESEND_SECONDS);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!enrollment.trim()) {
      setFieldError("Enter your enrollment number first.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      await sendOtp();
      setStep("OTP");
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Couldn't send the OTP. Please check your enrollment number and try again.";
      setFieldError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (otp.trim().length !== 6) {
      setFieldError("Enter the 6-digit OTP.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      const data = await verifyForgotPasswordOtp({
        enrollment: enrollment.trim(),
        otp: otp.trim(),
      });
      navigate("/reset-password", { state: { resetToken: data.data.resetToken } });
    } catch (error) {
      const message = error.response?.data?.message || "Invalid or expired OTP.";
      setFieldError(message);
      showToast(message, "error");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    try {
      await sendOtp();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to resend OTP.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Account recovery."
      tagline="Verify your identity with a one-time passcode sent to your registered college email, and regain access to your SRMS Connect account securely."
      features={FEATURES}
      cardTitle="Forgot password?"
      cardSubtitle={
        step === "ENROLLMENT"
          ? "Enter your enrollment number to receive an OTP."
          : "Enter the OTP sent to your registered email."
      }
    >
      {step === "ENROLLMENT" && (
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
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
            Send OTP
          </AuthButton>
        </form>
      )}

      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <AuthInput
            label="Enter OTP"
            icon={<KeyIcon />}
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            error={fieldError}
          />

          <div className="flex justify-between text-sm -mt-2">
            <button
              type="button"
              onClick={() => {
                setStep("ENROLLMENT");
                setOtp("");
                setFieldError("");
              }}
              className="text-[#1B2438]/60 hover:text-[#1B2438] font-medium"
            >
              Change enrollment
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || loading}
              className="text-[#C98A2B] hover:text-[#B37A22] font-medium disabled:text-[#1B2438]/30"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
            </button>
          </div>

          <AuthButton type="submit" loading={loading} loadingText="Verifying...">
            Verify OTP
          </AuthButton>
        </form>
      )}

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
