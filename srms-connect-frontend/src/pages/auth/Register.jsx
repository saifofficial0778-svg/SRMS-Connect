import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser, verifyRegisterOtp, resendRegisterOtp } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthInput from "../../components/auth/AuthInput";
import PasswordInput from "../../components/auth/PasswordInput";
import PasswordStrengthMeter from "../../components/auth/PasswordStrengthMeter";
import AuthButton from "../../components/auth/AuthButton";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import {
  IdCardIcon,
  CalendarIcon,
  UsersIcon,
  CompassIcon,
  ShieldIcon,
} from "../../components/auth/icons";

const FEATURES = [
  { icon: <UsersIcon />, text: "Connect with classmates" },
  { icon: <CompassIcon />, text: "Discover alumni" },
  { icon: <ShieldIcon />, text: "Build your professional profile" },
];

const RESEND_SECONDS = 60;

export default function Register() {
  const [step, setStep] = useState("FORM"); // "FORM" | "OTP"

  const [enrollment, setEnrollment] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [maskedEmail, setMaskedEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const startResendTimer = () => {
    setResendTimer(RESEND_SECONDS);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const validate = () => {
    const next = {};
    if (!enrollment.trim()) next.enrollment = "Enrollment number is required.";
    if (!dob) next.dob = "Date of birth is required.";
    if (!password) next.password = "Please create a password.";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password.";
    if (password && confirmPassword && password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Step 1: existing register API — ab OTP bhej dega, user create ho jayega (PENDING)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await registerUser({
        enrollment: enrollment.trim(),
        dob,
        password,
        confirmPassword,
      });
      setMaskedEmail(data.email);
      showToast(data.message);
      setStep("OTP");
      startResendTimer();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to create account. Please check your details.";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP verify
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!otp.trim() || otp.trim().length !== 6) {
      setErrors({ otp: "Enter the 6-digit OTP." });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const data = await verifyRegisterOtp({ enrollment: enrollment.trim(), otp: otp.trim() });
      showToast(data.message);
      setTimeout(() => navigate("/login"), 1000);
    } catch (error) {
      const message = error.response?.data?.message || "Invalid or expired OTP.";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    try {
      const data = await resendRegisterOtp(enrollment.trim());
      showToast(data.message);
      startResendTimer();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to resend OTP.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Your college network starts here."
      tagline="Create your SRMS Connect profile and start building your network from day one."
      features={FEATURES}
      cardTitle="Create account"
      cardSubtitle="Join the SRMS Connect community"
    >
      {step === "FORM" && (
        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          <AuthInput
            label="Enrollment Number"
            icon={<IdCardIcon />}
            placeholder="Enter enrollment number"
            value={enrollment}
            onChange={(e) => setEnrollment(e.target.value)}
            autoComplete="username"
            error={errors.enrollment}
          />

          <AuthInput
            label="Date of Birth"
            icon={<CalendarIcon />}
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            error={errors.dob}
          />

          <div>
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              error={errors.password}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            autoComplete="new-password"
            error={errors.confirmPassword}
          />

          <AuthButton type="submit" loading={loading} loadingText="Creating account...">
            Create Account
          </AuthButton>
        </form>
      )}

      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <p className="text-sm text-[#1B2438]/60 -mt-1">
            OTP sent to <span className="font-medium text-[#1B2438]">{maskedEmail}</span>
          </p>

          <AuthInput
            label="Enter OTP"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            error={errors.otp}
          />

          <div className="flex justify-end text-sm -mt-2">
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
            Verify & Complete Registration
          </AuthButton>
        </form>
      )}

      <p className="text-center text-sm text-[#1B2438]/60 mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-[#C98A2B] hover:text-[#B37A22] font-medium">
          Login
        </Link>
      </p>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AuthLayout>
  );
}