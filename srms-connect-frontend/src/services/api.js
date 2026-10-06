import axios from "axios";
import { handleResponseError } from "./authInterceptor";
import { disconnectSocket } from "./socket";

const API_URL = import.meta.env.VITE_API_BASE_URL;
const authApi = axios.create({
    baseURL: API_URL,
});

authApi.interceptors.request.use(
    (config) => {

        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 401 on an authenticated request = expired / revoked / blocked session:
// clear the stored login and send the user back to /login.
authApi.interceptors.response.use(
    (response) => response,
    (error) =>
        handleResponseError(error, {
            storage: localStorage,
            onClear: disconnectSocket,
            redirect: (path) => window.location.assign(path),
            getPathname: () => window.location.pathname,
        })
);

export default authApi;
