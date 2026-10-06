import authApi from "./api";
import { clearAuthState } from "./authInterceptor";
import { disconnectSocket } from "./socket";

// Revokes the session on the server first (so the token stops working everywhere),
// then clears local state even if that request fails (e.g. already expired).
export const logoutUser = async () => {
  try {
    await authApi.post("/auth/logout");
  } catch {
    // ignore - local logout must always succeed
  } finally {
    clearAuthState(localStorage);
    disconnectSocket();
  }
};

export const loginUser = async (credentials) => {
  const response = await authApi.post("/auth/login", credentials);
  return response.data;
};

export const registerUser = async (credentials) => {
  const response = await authApi.post("/auth/register", credentials);
  return response.data;
};

export const verifyRegisterOtp = async ({ enrollment, otp }) => {
  const response = await authApi.post("/auth/register/verify-otp", { enrollment, otp });
  return response.data;
};

export const resendRegisterOtp = async (enrollment) => {
  const response = await authApi.post("/auth/register/resend-otp", { enrollment });
  return response.data;
};

export const forgotPassword = async (credentials) => {
  const response = await authApi.post("/auth/forgot-password", credentials);
  return response.data;
};

export const verifyForgotPasswordOtp = async ({ enrollment, otp }) => {
  const response = await authApi.post("/auth/forgot-password/verify-otp", { enrollment, otp });
  return response.data;
};

export const resetPassword =async (credentials) => {
  const response = await authApi.post("/auth/reset-password", credentials);
  return response.data;
};

// OTP-based login
export const requestOtp = async (enrollment) => {
  const response = await authApi.post("/auth/otp/request", { enrollment });
  return response.data;
};

export const verifyOtp = async ({ enrollment, otp }) => {
  const response = await authApi.post("/auth/otp/verify", { enrollment, otp });
  return response.data;
};