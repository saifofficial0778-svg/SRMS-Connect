import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser, requestOtp, verifyOtp } from "../../services/authService";
import AuthLayout from "../../components/auth/AuthLayout";
import AuthInput from "../../components/auth/AuthInput";
import PasswordInput from "../../components/auth/PasswordInput";
import AuthButton from "../../components/auth/AuthButton";
import useToast from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { IdCardIcon, UsersIcon, CompassIcon, CheckIcon } from "../../components/auth/icons";

const FEATURES = [
  { icon: <UsersIcon />, text: "Connect with your college community" },
  { icon: <CompassIcon />, text: "Discover alumni across batches" },
  { icon: <CheckIcon />, text: "Build your professional network" },
];

const RESEND_SECONDS = 60;

export default function Login() {
  const [mode, setMode] = useState("password"); // "password" | "otp"
  const [otpStep, setOtpStep] = useState("enrollment"); // "enrollment" | "verify"

  const [enrollment, setEnrollment] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
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

  const switchMode = (newMode) => {
    setMode(newMode);
    setOtpStep("enrollment");
    setFieldError("");
    setPassword("");
    setOtp("");
  };

  // Password login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!enrollment.trim() || !password) {
      setFieldError("Please fill in both fields.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      const data = await loginUser({ enrollment: enrollment.trim(), password });
      localStorage.setItem("token", data.data.token);
      localStorage.setItem("userId", data.data.userId);
      localStorage.setItem("role", data.data.role);   // ye add karo

      if (data.data.role === "ADMIN") {
        navigate("/admin/users");
      } else {
        navigate("/home");
      }
    } catch (error) {
      const message =
        error.response?.data?.message || "Invalid enrollment number or password.";
      setFieldError(message);
      showToast(message, "error");
      setLoading(false);
    }
  };

  // Step 1 of OTP: send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!enrollment.trim()) {
      setFieldError("Please enter your enrollment number.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      await requestOtp(enrollment.trim());
      showToast("OTP sent to your registered email", "success");
      setOtpStep("verify");
      startResendTimer();
    } catch (error) {
      const message = error.response?.data?.message || "Failed to send OTP.";
      setFieldError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 of OTP: verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!otp.trim() || otp.trim().length !== 6) {
      setFieldError("Please enter the 6-digit OTP.");
      return;
    }
    setFieldError("");
    setLoading(true);
    try {
      const data = await verifyOtp({ enrollment: enrollment.trim(), otp: otp.trim() });
      localStorage.setItem("token", data.data.token);
      localStorage.setItem("userId", data.data.userId);
      localStorage.setItem("role", data.data.role);
      navigate("/home");
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
      await requestOtp(enrollment.trim());
      showToast("OTP resent to your email", "success");
      startResendTimer();
    } catch (error) {
      const message = error.response?.data?.message || "Failed to resend OTP.";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Your college network starts here."
      tagline="One place to connect with classmates, seniors, and alumni from SRMS."
      features={FEATURES}
      cardTitle="Welcome back"
      cardSubtitle="Log in to continue to SRMS Connect"
    >
      {/* Mode toggle */}
      <div className="flex mb-6 rounded-lg bg-ink/5 p-1">
        <button
          type="button"
          onClick={() => switchMode("password")}
          className={`flex-1 text-sm font-medium py-2 rounded-md transition ${mode === "password"
              ? "bg-white shadow text-ink"
              : "text-ink/60"
            }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => switchMode("otp")}
          className={`flex-1 text-sm font-medium py-2 rounded-md transition ${mode === "otp" ? "bg-white shadow text-ink" : "text-ink/60"
            }`}
        >
          OTP Login
        </button>
      </div>

      {/* Password mode */}
      {mode === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
          <AuthInput
            label="Enrollment Number"
            icon={<IdCardIcon />}
            placeholder="Enter your enrollment number"
            value={enrollment}
            onChange={(e) => setEnrollment(e.target.value)}
            autoComplete="username"
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          {fieldError && <p className="text-xs text-danger -mt-1">{fieldError}</p>}

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-accent-700 hover:text-accent-800 font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <AuthButton type="submit" loading={loading} loadingText="Logging in...">
            Login
          </AuthButton>
        </form>
      )}

      {/* OTP mode — step 1: enrollment */}
      {mode === "otp" && otpStep === "enrollment" && (
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
          <AuthInput
            label="Enrollment Number"
            icon={<IdCardIcon />}
            placeholder="Enter your enrollment number"
            value={enrollment}
            onChange={(e) => setEnrollment(e.target.value)}
            autoComplete="username"
          />

          {fieldError && <p className="text-xs text-danger -mt-1">{fieldError}</p>}

          <AuthButton type="submit" loading={loading} loadingText="Sending OTP...">
            Send OTP
          </AuthButton>
        </form>
      )}

      {/* OTP mode — step 2: verify */}
      {mode === "otp" && otpStep === "verify" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
          <p className="text-sm text-ink/60 -mt-1">
            OTP sent to the email linked with{" "}
            <span className="font-medium text-ink">{enrollment}</span>
          </p>

          <AuthInput
            label="Enter OTP"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
          />

          {fieldError && <p className="text-xs text-danger -mt-1">{fieldError}</p>}

          <div className="flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={() => setOtpStep("enrollment")}
              className="text-ink/60 hover:text-ink"
            >
              Change enrollment
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || loading}
              className="text-accent-700 hover:text-accent-800 font-medium disabled:text-ink/30"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
            </button>
          </div>

          <AuthButton type="submit" loading={loading} loadingText="Verifying...">
            Verify & Login
          </AuthButton>
        </form>
      )}

      <p className="text-center text-sm text-ink/60 mt-6">
        New to SRMS Connect?{" "}
        <Link to="/register" className="text-accent-700 hover:text-accent-800 font-medium">
          Create an account
        </Link>
      </p>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AuthLayout>
  );
}