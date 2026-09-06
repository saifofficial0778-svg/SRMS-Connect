import authApi from "./api";

export const loginUser = async (credentials) => {
  const response = await authApi.post("/auth/login", credentials);
  return response.data;
};

export const registerUser=async(credentials)=>{
  const response=await authApi.post("/auth/register",credentials)
  return response.data
}

export const forgotPassword=async(credentials)=>{
  const response=await authApi.post("/auth/forgot-password",credentials)
  return response.data
}

export const resetPassword=async(credentials)=>{
  const response=await authApi.post("/auth/reset-password",credentials)
  return response.data
}

