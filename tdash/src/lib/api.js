import axios from 'axios';
import { getApiBaseUrl } from './runtimeConfig';
import {
    clearStoredSession,
    emitAuthExpired,
    getAccessToken,
    getRefreshToken,
    updateStoredTokens,
} from './session';

const axiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

const refreshClient = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshRequest = null;

const isAuthRoute = (url = '') => (
    ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
        .some((route) => url.includes(route))
);

const refreshAccessToken = async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
        throw new Error('Missing refresh token');
    }

    if (!refreshRequest) {
        refreshRequest = refreshClient
            .post('/auth/refresh', { refreshToken })
            .then((response) => {
                const tokens = response.data?.data || {};
                updateStoredTokens(tokens);
                return tokens;
            })
            .finally(() => {
                refreshRequest = null;
            });
    }

    return refreshRequest;
};

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
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
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config;

        if (status === 401) {
            if (!originalRequest || isAuthRoute(originalRequest.url)) {
                return Promise.reject(error);
            }

            if (originalRequest._retry) {
                clearStoredSession();
                emitAuthExpired();
                return Promise.reject(error);
            }

            try {
                originalRequest._retry = true;

                const { accessToken } = await refreshAccessToken();
                originalRequest.headers = {
                    ...originalRequest.headers,
                    Authorization: `Bearer ${accessToken}`,
                };

                return axiosInstance(originalRequest);
            } catch (refreshError) {
                clearStoredSession();
                emitAuthExpired();
                return Promise.reject(refreshError);
            }
        }

        // Handle Waiting Room (503)
        if (status === 503) {
            window.dispatchEvent(new CustomEvent('tixmo:waiting-room'));
        }

        // Dispatch global error for other failure codes (e.g. 500, 404, network error)
        else {
            window.dispatchEvent(new CustomEvent('tixmo:global-error', {
                detail: {
                    status: status || 'NETWORK_ERR',
                    message: error.response?.data?.message || error.message
                }
            }));
        }

        return Promise.reject(error);
    }
);

// Default export for backward compatibility
export default axiosInstance;

const normalizeResponse = (body) => {
    if (!body || typeof body !== 'object') {
        return body;
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
        return body;
    }

    const payload = body.data;

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return {
            ...payload,
            data: payload,
            success: body.success,
            message: body.message,
            meta: body.meta,
            raw: body,
        };
    }

    return {
        data: payload,
        success: body.success,
        message: body.message,
        meta: body.meta,
        raw: body,
    };
};

// Helper wrapper for cleaner API calls with automatic data extraction
export const api = {
    get: async (url) => {
        const response = await axiosInstance.get(url);
        return normalizeResponse(response.data);
    },
    post: async (url, data) => {
        const response = await axiosInstance.post(url, data);
        return normalizeResponse(response.data);
    },
    put: async (url, data) => {
        const response = await axiosInstance.put(url, data);
        return normalizeResponse(response.data);
    },
    patch: async (url, data) => {
        const response = await axiosInstance.patch(url, data);
        return normalizeResponse(response.data);
    },
    delete: async (url) => {
        const response = await axiosInstance.delete(url);
        return normalizeResponse(response.data);
    },
    upload: async (url, formData) => {
        const response = await axiosInstance.post(url, formData, {
            headers: {
                'Content-Type': null, // Unset default to allow browser to set multipart/form-data with boundary
            },
        });
        return normalizeResponse(response.data);
    },
};
