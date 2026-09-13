import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../../services/authService";
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

export default function Login() {
  const [enrollment, setEnrollment] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();

  const handleLogin = async (e) => {
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
      navigate("/home");
    } catch (error) {
      const message =
        error.response?.data?.message || "Invalid enrollment number or password.";
      setFieldError(message);
      showToast(message, "error");
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
      <form onSubmit={handleLogin} className="space-y-4" noValidate>
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

        {fieldError && <p className="text-xs text-[#B3432B] -mt-1">{fieldError}</p>}

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-[#C98A2B] hover:text-[#B37A22] font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <AuthButton type="submit" loading={loading} loadingText="Logging in...">
          Login
        </AuthButton>
      </form>

      <p className="text-center text-sm text-[#1B2438]/60 mt-6">
        New to SRMS Connect?{" "}
        <Link to="/register" className="text-[#C98A2B] hover:text-[#B37A22] font-medium">
          Create an account
        </Link>
      </p>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AuthLayout>
  );
}
