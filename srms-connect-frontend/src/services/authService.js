import authApi from "./api";

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

export const resetPassword = async (credentials) => {
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