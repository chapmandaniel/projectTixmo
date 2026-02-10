import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle auth errors (401)
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Optional: redirect to login or clear token
            // window.location.href = '/login'; 
            console.warn('Unauthorized access, token might be invalid');
        }

        // Handle Waiting Room (503)
        if (error.response?.status === 503) {
            window.dispatchEvent(new CustomEvent('tixmo:waiting-room'));
        }

        // Dispatch global error for other failure codes (e.g. 500, 404, network error)
        else if (error.response?.status !== 401) {
            window.dispatchEvent(new CustomEvent('tixmo:global-error', {
                detail: {
                    status: error.response?.status || 'NETWORK_ERR',
                    message: error.response?.data?.message || error.message
                }
            }));
        }

        return Promise.reject(error);
    }
);

// Default export for backward compatibility
export default axiosInstance;

// Helper wrapper for cleaner API calls with automatic data extraction
export const api = {
    get: async (url) => {
        const response = await axiosInstance.get(url);
        return response.data;
    },
    post: async (url, data) => {
        const response = await axiosInstance.post(url, data);
        return response.data;
    },
    put: async (url, data) => {
        const response = await axiosInstance.put(url, data);
        return response.data;
    },
    delete: async (url) => {
        const response = await axiosInstance.delete(url);
        return response.data;
    },
    upload: async (url, formData) => {
        const response = await axiosInstance.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
};
