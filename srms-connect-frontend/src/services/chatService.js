import authApi from "./api";

// ASSUMPTION: same convention as your other modules — router mounted as
// e.g. `app.use("/api/chat", chatRouter)`. If your actual mount path is
// different, update BASE below.
const BASE = "/chat";

export const getConversations = async () => {
    const response = await authApi.get(`${BASE}/conversations`);
    return response.data;
};

export const getOrCreateConversation = async (userId) => {
    const response = await authApi.get(`${BASE}/${userId}`);
    return response.data;
};

export const getMessages = async (conversationId, { page = 1, limit = 30 } = {}) => {
    const response = await authApi.get(`${BASE}/${conversationId}/messages`, {
        params: { page, limit },
    });
    return response.data;
};

export const sendMessageRest = async (conversationId, content) => {
    const response = await authApi.post(`${BASE}/${conversationId}/messages`, { content });
    return response.data;
};

export const markConversationRead = async (conversationId) => {
    const response = await authApi.patch(`${BASE}/${conversationId}/read`);
    return response.data;
};
