import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
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
api.interceptors.response.use(
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

export default api;
