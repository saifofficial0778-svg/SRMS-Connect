import authApi from "./api";

// Get Profile
export const getProfile = async () => {
    const response = await authApi.get("/profile");
    return response.data;
};


// Update Profile
export const updateProfile = async (profileData) => {
    const response = await authApi.patch("/profile", profileData);
    return response.data;
};


// Update Profile Photo (Cloudinary upload)
export const updateProfilePhoto = async (file) => {
    const formData = new FormData();
    formData.append("photo", file);
    // Do NOT set Content-Type manually — axios/the browser must generate it
    // themselves so it includes the multipart boundary. A hardcoded
    // "multipart/form-data" header (without boundary) makes multer fail to
    // parse the body, so req.file ends up undefined on the backend.
    const response = await authApi.patch("/profile/photo", formData);
    return response.data;
};


// Remove Profile Photo (Cloudinary delete)
export const deleteProfilePhoto = async () => {
    const response = await authApi.delete("/profile/photo");
    return response.data;
};


// Add Skill
export const addSkill = async (skillData) => {
    const response = await authApi.post("/profile/skills", skillData);
    return response.data;
};


// Delete Skill
export const deleteSkill = async (skillId) => {
    const response = await authApi.delete(`/profile/skills/${skillId}`);
    return response.data;
};


// Add Project
export const addProject = async (projectData) => {
    const response = await authApi.post("/profile/projects", projectData);
    return response.data;
};


// Delete Project
export const deleteProject = async (projectId) => {
    const response = await authApi.delete(`/profile/projects/${projectId}`);
    return response.data;
};

export const getPublicProfileById = async (userId) => {
    const response = await authApi.get(`/profile/${userId}`);
    return response.data;
};