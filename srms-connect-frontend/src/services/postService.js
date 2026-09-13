import authApi from "./api";

// Create a post — content is optional if at least one media file is attached.
export const createPost = async (content, files = []) => {
    const formData = new FormData();
    if (content) formData.append("content", content);
    files.forEach((file) => formData.append("media", file));

    // No manual Content-Type here either — see the note in
    // profileService.js's updateProfilePhoto for why.
    const response = await authApi.post("/posts", formData);
    return response.data;
};

export const updatePost = async (postId, content) => {
    const response = await authApi.patch(`/posts/${postId}`, { content });
    return response.data;
};

export const deletePost = async (postId) => {
    const response = await authApi.delete(`/posts/${postId}`);
    return response.data;
};

export const likePost = async (postId) => {
    const response = await authApi.post(`/posts/${postId}/like`);
    return response.data;
};

export const unlikePost = async (postId) => {
    const response = await authApi.delete(`/posts/${postId}/like`);
    return response.data;
};

export const getComments = async (postId) => {
    const response = await authApi.get(`/posts/${postId}/comments`);
    return response.data;
};

export const addComment = async (postId, content) => {
    const response = await authApi.post(`/posts/${postId}/comments`, { content });
    return response.data;
};

export const updateComment = async (commentId, content) => {
    const response = await authApi.patch(`/posts/comments/${commentId}`, { content });
    return response.data;
};

export const deleteComment = async (commentId) => {
    const response = await authApi.delete(`/posts/comments/${commentId}`);
    return response.data;
};

export const getFeed = async (page = 1, limit = 10) => {
    const response = await authApi.get("/posts/feed", { params: { page, limit } });
    return response.data;
};