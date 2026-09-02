import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

const authApi = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

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

