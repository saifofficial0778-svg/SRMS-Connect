import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../../services/authService";
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

export default function Register() {
  const [enrollment, setEnrollment] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const validate = () => {
    const next = {};
    if (!enrollment.trim()) next.enrollment = "Enrollment number is required.";
    if (!dob) next.dob = "Date of birth is required.";
    if (!password) next.password = "Please create a password.";
    if (confirmPassword && password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    if (!confirmPassword) next.confirmPassword = "Please confirm your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

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
      showToast("Account created. Redirecting to login...");
      // brief pause so the success toast is actually visible before we navigate away
      setTimeout(() => navigate("/login"), 700);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to create account. Please check your details.";
      showToast(message, "error");
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
