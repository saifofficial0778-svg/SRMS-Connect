import authApi from "./api";

export const getUsers = async (params) => {
  const response = await authApi.get("/users", { params });
  return response.data;
};

export const getUserById = async (id) => {
  const response = await authApi.get(`/users/${id}`);
  return response.data;
};

export const updateUserStatus = async (id, status, reason) => {
  const response = await authApi.patch(`/users/${id}/status`, { status, reason });
  return response.data;
};