import authApi from "./api";

const BASE = "/connections";

export const sendConnectionRequest = async (userId) => {
  const response = await authApi.post(`${BASE}/${userId}/request`);
  return response.data;
};

export const acceptConnectionRequest = async (id) => {
  const response = await authApi.patch(`${BASE}/${id}/accept`);
  return response.data;
};

export const rejectConnectionRequest = async (id) => {
  const response = await authApi.patch(`${BASE}/${id}/reject`);
  return response.data;
};

export const cancelConnectionRequest = async (id) => {
  const response = await authApi.patch(`${BASE}/${id}/cancel`);
  return response.data;
};

export const removeConnection = async (id) => {
  const response = await authApi.delete(`${BASE}/${id}`);
  return response.data;
};

export const getMyConnections = async () => {
  const response = await authApi.get(`${BASE}/`);
  return response.data;
};

export const getReceivedRequests = async () => {
  const response = await authApi.get(`${BASE}/requests/received`);
  return response.data;
};

// the members someone is connected with, and how you stand with each (suggestions under a profile)
export const getProfileConnections = async (userId) => {
  const response = await authApi.get(`${BASE}/of/${userId}`);
  return response.data?.data?.people || [];
};

export const getSentRequests = async () => {
  const response = await authApi.get(`${BASE}/requests/sent`);
  return response.data;
};
// "People you may know": members you are not connected with, best-connected first
export const getSuggestions = async () => {
  const response = await authApi.get(`${BASE}/suggestions`);
  return response.data?.data?.people || [];
};
